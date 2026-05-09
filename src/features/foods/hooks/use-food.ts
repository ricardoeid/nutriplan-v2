import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type { Database } from '@/types/database'

import { foodKeys } from '../lib/query-keys'

type FoodRow = Database['public']['Tables']['foods']['Row']

// Hook de fetch de UM food por id. Faz join com user_food_prefs do
// user atual pra trazer is_favorite e is_hidden — esses dois flags
// são por user, não globais.
//
// Retorna `food` completo + flag `isOwn` indicando se o user pode
// editar (foods custom/composite criadas por ele). TACO/OFF e foods
// de outros users são readonly mesmo se id existir.
export function useFood(foodId: string | undefined) {
  const { user } = useAuth()
  const userId = user?.id

  const result = useQuery({
    queryKey: foodKeys.detail(foodId),
    enabled: !!userId && !!foodId,
    queryFn: async () => {
      if (!userId || !foodId) throw new Error('No user or foodId')

      // Fetch principal: food row inteira
      const { data: food, error } = await supabase
        .from('foods')
        .select('*')
        .eq('id', foodId)
        .single()

      if (error) throw error

      // Fetch lateral: pref do user atual (pode não existir).
      // Não é erro se vier vazio — user nunca interagiu com esse food.
      const { data: pref } = await supabase
        .from('user_food_prefs')
        .select('is_favorite, is_hidden, use_count, last_used')
        .eq('user_id', userId)
        .eq('food_id', foodId)
        .maybeSingle()

      return {
        food: food as FoodRow,
        isFavorite: pref?.is_favorite ?? false,
        isHidden: pref?.is_hidden ?? false,
        useCount: pref?.use_count ?? 0,
        lastUsed: pref?.last_used ?? null,
      }
    },
  })

  // `isOwn`: pode editar? Combina ownership + source editável.
  // TACO e OFF nunca são editáveis (mesmo se vierem com user_id).
  const food = result.data?.food
  const isOwn =
    !!userId &&
    !!food &&
    food.user_id === userId &&
    (food.source === 'custom' || food.source === 'composite')

  return {
    food: result.data?.food,
    isFavorite: result.data?.isFavorite ?? false,
    isHidden: result.data?.isHidden ?? false,
    useCount: result.data?.useCount ?? 0,
    lastUsed: result.data?.lastUsed ?? null,
    isOwn,
    loading: result.isLoading,
    error: result.error,
  }
}
