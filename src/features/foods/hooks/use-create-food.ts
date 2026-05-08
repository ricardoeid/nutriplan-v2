import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type { Database } from '@/types/database'

import { foodKeys } from '../lib/query-keys'
import type { CustomFoodParsedData } from '../lib/schemas'

type FoodInsert = Database['public']['Tables']['foods']['Insert']

// Normaliza string vazia/whitespace pra null. Schema removeu o
// `.transform()` por incompatibilidade com RHF, então a normalização
// vem pra cá. Trim já foi aplicado pelo zod (`.trim()` no schema).
function emptyToNull(value: string | undefined | null): string | null {
  if (value == null) return null
  if (value.length === 0) return null
  return value
}

// Converte os 4 macros do modo `perServing` pra escala per-100g.
// Faz 1 chamada por macro, sem sair do número (multiplicação direta).
//
// Fórmula: per100g = perServing * (100 / servingG)
//   ex: 1 ovo de 50g com 78 kcal → 78 * (100/50) = 156 kcal/100g
//
// O banco armazena SEMPRE per-100g (campo `kcal_per_100g`, etc). É a
// forma canônica que o resto do sistema (search_foods, log_entries,
// motor de substituição) consome.
function convertServingToPer100g(args: {
  servingG: number
  kcalPerServing: number
  proteinPerServing: number
  carbPerServing: number
  fatPerServing: number
}) {
  const factor = 100 / args.servingG
  return {
    kcal_per_100g: args.kcalPerServing * factor,
    protein_per_100g: args.proteinPerServing * factor,
    carb_per_100g: args.carbPerServing * factor,
    fat_per_100g: args.fatPerServing * factor,
  }
}

// Mutation pra criar custom food. Invalida `foodKeys.all` no success
// pra forçar refetch das listas (especialmente o filtro 'mine').
//
// Recebe `CustomFoodParsedData` (output do zod) — opcionais já
// resolvidos como `string | undefined`.
export function useCreateFood() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userId = user?.id

  return useMutation({
    mutationFn: async (data: CustomFoodParsedData) => {
      if (!userId) throw new Error('Não autenticado.')

      // Converte macros pro formato canônico per-100g
      const macros =
        data.mode === 'per100g'
          ? {
              kcal_per_100g: data.kcalPer100g,
              protein_per_100g: data.proteinPer100g,
              carb_per_100g: data.carbPer100g,
              fat_per_100g: data.fatPer100g,
            }
          : convertServingToPer100g({
              servingG: data.defaultServingG,
              kcalPerServing: data.kcalPerServing,
              proteinPerServing: data.proteinPerServing,
              carbPerServing: data.carbPerServing,
              fatPerServing: data.fatPerServing,
            })

      const payload: FoodInsert = {
        user_id: userId,
        source: 'custom',
        name: data.name,
        brand: emptyToNull(data.brand),
        default_serving_g: data.defaultServingG,
        serving_label: emptyToNull(data.servingLabel),
        recalc_whole_units_only: data.recalcWholeUnitsOnly,
        ...macros,
      }

      const { data: created, error } = await supabase
        .from('foods')
        .insert(payload)
        .select()
        .single()

      if (error) throw error
      return created
    },
    onSuccess: () => {
      // Derruba todas as buscas pra que "Meus" reflita o novo food
      queryClient.invalidateQueries({ queryKey: foodKeys.all })
    },
  })
}
