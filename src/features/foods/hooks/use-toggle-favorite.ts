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
  data: unknown
}

// Shape esperado do cache `foods/detail/:id` — definido em use-food.ts.
// Duplicado aqui em vez de importado pra evitar import cíclico
// (use-food → use-toggle-favorite no caso de detail logar e favoritar).
interface FoodDetailCache {
  food: { id: string; [k: string]: unknown }
  isFavorite: boolean
  isHidden: boolean
  useCount: number
  lastUsed: string | null
}

// Mutation pra alternar `user_food_prefs.is_favorite`. Usa upsert com
// onConflict='user_id,food_id' (existe UNIQUE constraint nessa dupla),
// o que cobre tanto criar quanto atualizar a pref.
//
// Optimistic update toca dois tipos de cache distintos:
//   - 'foods/search/...'  → array de FoodSearchResult; map+update do flag
//   - 'foods/detail/:id'  → objeto { food, isFavorite, ... }; spread+update
//
// Não dá pra usar setQueriesData genérico em foodKeys.all porque os dois
// formatos são incompatíveis (.map quebra em objeto). Cada shape tem
// seu próprio update.
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

      // Snapshot de TODOS os caches da feature antes de mexer.
      // Guarda chave + data crus pra rollback fiel sem assumir shape.
      const snapshots: SnapshotEntry[] = []
      const allQueries = queryClient.getQueriesData({
        queryKey: foodKeys.all,
      })
      for (const [key, data] of allQueries) {
        if (data !== undefined) {
          snapshots.push({ queryKey: key, data })
        }
      }

      // === Update 1: caches de busca (arrays) ===
      // Filtra explicitamente pelo segundo elemento da key = 'search'.
      // Usa setQueriesData com filter mais específico pra não cair em
      // queries de detail por engano.
      queryClient.setQueriesData<FoodSearchResult[]>(
        {
          queryKey: foodKeys.all,
          predicate: (query) => query.queryKey[1] === 'search',
        },
        (old) => {
          if (!old) return old
          return old.map((food) =>
            food.id === foodId
              ? { ...food, is_favorite: nextValue }
              : food,
          )
        },
      )

      // === Update 2: cache de detail (objeto) ===
      // Só atualiza se for o detail desse foodId específico.
      queryClient.setQueryData<FoodDetailCache>(
        foodKeys.detail(foodId),
        (old) => {
          if (!old) return old
          return { ...old, isFavorite: nextValue }
        },
      )

      return { snapshots }
    },

    onError: (error, _vars, context) => {
      // Rollback usando snapshots (preserva shape original de cada query)
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
