import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/hooks/useAuth'

import { foodKeys } from '../lib/query-keys'

// Estrutura mínima dos foods hidden retornados — só o necessário pra
// exibir e desocultar (id + name + brand pra display). Sem macros,
// porque a seção é pra desocultar rápido, não pra browse.
export interface HiddenFoodSummary {
  id: string
  name: string
  brand: string | null
}

// Hook que retorna a lista de foods que o user tem `is_hidden=true`.
//
// Query: user_food_prefs WHERE user_id=me AND is_hidden=true,
// joined com foods (pra trazer name/brand).
//
// Não usa search_foods porque essa RPC FILTRA hidden out por design
// (esse é o ponto dela). Pra ver os hidden, query direta na tabela.
export function useHiddenFoods() {
  const { user } = useAuth()
  const userId = user?.id

  const result = useQuery({
    queryKey: foodKeys.hidden(),
    enabled: !!userId,
    queryFn: async (): Promise<HiddenFoodSummary[]> => {
      if (!userId) throw new Error('No user')

      // Join via FK user_food_prefs.food_id → foods.id
      // Supabase aceita esse formato de select nested.
      const { data, error } = await supabase
        .from('user_food_prefs')
        .select(
          `
          food_id,
          foods (
            id,
            name,
            brand
          )
        `,
        )
        .eq('user_id', userId)
        .eq('is_hidden', true)
        .order('food_id') // order estável, não importa o critério exato

      if (error) throw error

      // Filtra rows onde join veio null (food deletado? improvável,
      // mas defensivo) e flatten pro shape final.
      return (data ?? [])
        .filter((row) => row.foods != null)
        .map((row) => {
          // `foods` pode ser objeto ou array dependendo da versão do
          // supabase-js. Normalizamos pra objeto.
          const food = Array.isArray(row.foods) ? row.foods[0] : row.foods
          return {
            id: food.id,
            name: food.name,
            brand: food.brand,
          }
        })
    },
  })

  return {
    hiddenFoods: result.data ?? [],
    loading: result.isLoading,
    error: result.error,
  }
}
