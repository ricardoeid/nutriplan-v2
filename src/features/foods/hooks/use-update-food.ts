import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type { Database } from '@/types/database'

import { foodKeys } from '../lib/query-keys'
import type { EditFoodParsedData } from '../lib/schemas'

type FoodUpdate = Database['public']['Tables']['foods']['Update']

interface UpdateFoodInput {
  foodId: string
  data: EditFoodParsedData
}

// Normaliza string vazia/whitespace pra null. Schema removeu o
// `.transform()` por incompatibilidade com RHF, então a normalização
// vem pra cá.
function emptyToNull(value: string | undefined | null): string | null {
  if (value == null) return null
  if (value.length === 0) return null
  return value
}

// Mutation pra editar custom food existente. Edit usa SEMPRE per-100g
// (sem dual-mode) — o banco guarda canônico e não dá pra reverter
// pra "Por porção" sem ambiguidade.
//
// `macros_manually_overridden=true` é setado pra registrar que o user
// editou manualmente (relevante quando OFF ressincroniza dados — esse
// flag deveria proteger overrides do user). Custom foods sempre têm
// esse flag true após edit.
//
// Não envia `source`, `external_id`, `is_archived`, `created_at`,
// `user_id` — campos imutáveis ou gerenciados pelo sistema.
export function useUpdateFood() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userId = user?.id

  return useMutation({
    mutationFn: async ({ foodId, data }: UpdateFoodInput) => {
      if (!userId) throw new Error('Não autenticado.')

      const payload: FoodUpdate = {
        name: data.name,
        brand: emptyToNull(data.brand),
        default_serving_g: data.defaultServingG,
        serving_label: emptyToNull(data.servingLabel),
        recalc_whole_units_only: data.recalcWholeUnitsOnly,
        kcal_per_100g: data.kcalPer100g,
        protein_per_100g: data.proteinPer100g,
        carb_per_100g: data.carbPer100g,
        fat_per_100g: data.fatPer100g,
        macros_manually_overridden: true,
      }

      const { data: updated, error } = await supabase
        .from('foods')
        .update(payload)
        .eq('id', foodId)
        // Defesa em profundidade: RLS já deveria bloquear update em
        // food de outro user, mas filtrar explícito é cinto+suspensório.
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error
      return updated
    },
    onSuccess: (_data, { foodId }) => {
      // Derruba o detail desse food + todas as buscas
      queryClient.invalidateQueries({ queryKey: foodKeys.detail(foodId) })
      queryClient.invalidateQueries({ queryKey: foodKeys.all })
    },
  })
}
