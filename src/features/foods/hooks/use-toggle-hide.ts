import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/hooks/useAuth'

import { foodKeys } from '../lib/query-keys'
import type { FoodSearchResult } from '../lib/types'

interface ToggleHideVars {
  foodId: string
  // Estado ATUAL (antes do toggle). Hook inverte e persiste.
  // Necessário em separado porque a row de search_foods NÃO retorna
  // `is_hidden` (a RPC filtra ocultos out antes de retornar). Pra
  // ocultar a partir da busca, currentIsHidden sempre é false; pra
  // desocultar da `useHiddenFoods` é sempre true.
  currentIsHidden: boolean
}

interface SnapshotEntry {
  queryKey: readonly unknown[]
  data: unknown
}

interface FoodDetailCache {
  food: { id: string; [k: string]: unknown }
  isFavorite: boolean
  isHidden: boolean
  useCount: number
  lastUsed: string | null
}

// Mutation pra alternar `user_food_prefs.is_hidden`. Usa upsert com
// onConflict='user_id,food_id' — mesma estratégia do toggle favorite.
//
// Diferença importante vs toggle favorite: quando user OCULTA um food
// que aparece na busca, ele deve SUMIR da lista imediatamente — a RPC
// search_foods filtra hidden. O optimistic update FILTRA a row dos
// caches de busca (não só atualiza flag).
//
// O undo é responsabilidade do CHAMADOR — esse hook só persiste o
// estado solicitado. Toast com botão "Desfazer" mora em foods.tsx /
// food-detail.tsx, e ao clicar dispara essa mesma mutation com o
// `currentIsHidden` invertido.
export function useToggleHide() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userId = user?.id

  return useMutation({
    mutationFn: async ({ foodId, currentIsHidden }: ToggleHideVars) => {
      if (!userId) throw new Error('Não autenticado.')

      const nextValue = !currentIsHidden

      const { error } = await supabase
        .from('user_food_prefs')
        .upsert(
          {
            user_id: userId,
            food_id: foodId,
            is_hidden: nextValue,
          },
          { onConflict: 'user_id,food_id' },
        )

      if (error) throw error
      return { foodId, nextValue }
    },

    onMutate: async ({ foodId, currentIsHidden }) => {
      const nextValue = !currentIsHidden

      await queryClient.cancelQueries({ queryKey: foodKeys.all })

      // Snapshot pra rollback
      const snapshots: SnapshotEntry[] = []
      const allQueries = queryClient.getQueriesData({
        queryKey: foodKeys.all,
      })
      for (const [key, data] of allQueries) {
        if (data !== undefined) {
          snapshots.push({ queryKey: key, data })
        }
      }

      if (nextValue) {
        // === Ocultar: REMOVER row dos caches de busca ===
        queryClient.setQueriesData<FoodSearchResult[]>(
          {
            queryKey: foodKeys.all,
            predicate: (query) => query.queryKey[1] === 'search',
          },
          (old) => {
            if (!old) return old
            return old.filter((food) => food.id !== foodId)
          },
        )
        // Detail: atualizar isHidden=true
        queryClient.setQueryData<FoodDetailCache>(
          foodKeys.detail(foodId),
          (old) => (old ? { ...old, isHidden: true } : old),
        )
      } else {
        // === Desocultar: row reaparece via invalidate em onSettled ===
        // Optimistic não tem como ADICIONAR uma row que nem está no
        // cache de busca. Detail sim, vira isHidden=false.
        queryClient.setQueryData<FoodDetailCache>(
          foodKeys.detail(foodId),
          (old) => (old ? { ...old, isHidden: false } : old),
        )
      }

      return { snapshots }
    },

    onError: (error, _vars, context) => {
      if (context?.snapshots) {
        for (const { queryKey, data } of context.snapshots) {
          queryClient.setQueryData(queryKey, data)
        }
      }
      const message =
        error instanceof Error ? error.message : 'erro desconhecido'
      toast.error(`Não foi possível ocultar: ${message}`)
    },

    onSettled: () => {
      // Reconcilia com servidor. Crítico no DESOCULTAR pra que a row
      // volte a aparecer na busca (RPC reincluí ela).
      queryClient.invalidateQueries({ queryKey: foodKeys.all })
    },
  })
}
