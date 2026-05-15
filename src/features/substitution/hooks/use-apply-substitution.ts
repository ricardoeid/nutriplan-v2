import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { logKeys } from '@/features/log/lib/query-keys'
import { planKeys } from '@/features/plans/lib/query-keys'

// Payload pra RPC apply_substitution (migration 20260515180000).
//
// Estrutura espelha o que o engine produz + o que o user confirmou no
// commit sheet (entries descheckadas são removidas antes de chamar).
//
// Macros nas entries são pré-computadas no client (snapshot pattern):
// engine devolve macros via foodMacrosAtQty; caller arredonda pra 1
// casa antes de mandar.

export interface ApplyTargetAdjustment {
  plan_slot_id: string
  plan_option_id: string
  option_item_id: string
  adjusted_quantity_g: number
}

export interface ApplyFutureAdjustment extends ApplyTargetAdjustment {
  plan_meal_id: string
}

export interface ApplyEntry {
  food_id: string
  quantity_g: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  plan_slot_id: string | null
  plan_option_id: string | null
  is_off_plan: boolean
}

export interface ApplySubstitutionPayload {
  log_meal_id: string
  adjustment_date: string // YYYY-MM-DD
  plan_id: string
  plan_meal_id: string
  target_entries: ApplyEntry[]
  target_adjustments: ApplyTargetAdjustment[]
  future_adjustments: ApplyFutureAdjustment[]
  food_ids_to_bump: string[]
}

interface ApplySubstitutionVars {
  dateISO: string
  payload: ApplySubstitutionPayload
}

// Mutation que chama a RPC apply_substitution. Atômico: ou tudo entra
// (entries + adjustments + bumps) ou nada. Em rede ruim (Capacitor)
// elimina o risco de estado intermediário que a sequência client-side
// teria.
//
// onSettled invalida planKeys.all (cobre tree + adjustments) e
// logKeys.daily(date) (refeição-alvo e refeições futuras na Home).
// /plano e Home re-renderizam com o estado pós-substituição.
//
// Cast as never em supabase.rpc — database.ts ainda não conhece a RPC
// nova. Após aplicar migration + regerar tipos, cast sai.
export function useApplySubstitution() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ payload }: ApplySubstitutionVars) => {
      const { error } = await supabase.rpc(
        'apply_substitution' as never,
        { p_payload: payload } as never,
      )
      if (error) throw error
    },
    onSettled: (_data, _error, vars) => {
      queryClient.invalidateQueries({ queryKey: planKeys.all })
      queryClient.invalidateQueries({ queryKey: logKeys.daily(vars.dateISO) })
    },
  })
}
