import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/hooks/useAuth'

import { foodKeys } from '../lib/query-keys'
import type { FoodSearchResult } from '../lib/types'

interface ToggleFavoriteVars {
  foodId: string
  // Estado ATUAL (antes do toggle). Hook inverte e persiste.
  // Exigir explícito evita race condition do tipo "li o estado X,
  // mas no momento da mutation o estado já é Y".
  currentIsFavorite: boolean
}

interface SnapshotEntry {
  queryKey: readonly unknown[]
  data: FoodSearchResult[]
}

// Mutation pra alternar `user_food_prefs.is_favorite`. Usa upsert com
// onConflict='user_id,food_id' (existe UNIQUE constraint nessa dupla),
// o que cobre tanto criar quanto atualizar a pref.
//
// Optimistic update varre TODOS os caches de busca (search keys variam
// por query/filter/limit) e atualiza a row do food em todas. Em caso
// de erro, rollback completo via snapshot.
export function useToggleFavorite() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userId = user?.id

  return useMutation({
    mutationFn: async ({ foodId, currentIsFavorite }: ToggleFavoriteVars) => {
      if (!userId) throw new Error('Não autenticado.')

      const nextValue = !currentIsFavorite

      const { error } = await supabase
        .from('user_food_prefs')
        .upsert(
          {
            user_id: userId,
            food_id: foodId,
            is_favorite: nextValue,
          },
          { onConflict: 'user_id,food_id' },
        )

      if (error) throw error
      return { foodId, nextValue }
    },

    onMutate: async ({ foodId, currentIsFavorite }) => {
      const nextValue = !currentIsFavorite

      // Cancela refetches em vôo pra não sobrescrever o optimistic
      await queryClient.cancelQueries({ queryKey: foodKeys.all })

      // Snapshot de TODOS os caches de busca antes de mexer
      const snapshots: SnapshotEntry[] = []
      const queries = queryClient.getQueriesData<FoodSearchResult[]>({
        queryKey: foodKeys.all,
      })
      for (const [key, data] of queries) {
        if (data) {
          snapshots.push({ queryKey: key, data })
        }
      }

      // Aplica update otimista em todos os caches
      queryClient.setQueriesData<FoodSearchResult[]>(
        { queryKey: foodKeys.all },
        (old) => {
          if (!old) return old
          return old.map((food) =>
            food.id === foodId
              ? { ...food, is_favorite: nextValue }
              : food,
          )
        },
      )

      return { snapshots }
    },

    onError: (error, _vars, context) => {
      // Rollback usando snapshots
      if (context?.snapshots) {
        for (const { queryKey, data } of context.snapshots) {
          queryClient.setQueryData(queryKey, data)
        }
      }
      const message =
        error instanceof Error ? error.message : 'erro desconhecido'
      toast.error(`Não foi possível favoritar: ${message}`)
    },

    onSettled: () => {
      // Reconcilia com o servidor. Crítico pro filtro 'favorites':
      // se o user desfavoritou um item enquanto esse filtro tava ativo,
      // o item precisa sumir da lista (RPC não retorna mais ele).
      // Optimistic só atualiza o flag, não remove a row.
      queryClient.invalidateQueries({ queryKey: foodKeys.all })
    },
  })
}
