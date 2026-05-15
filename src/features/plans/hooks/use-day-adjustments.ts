import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type { Database } from '@/types/database'

import { planKeys } from '../lib/query-keys'

// Hooks de `plan_day_adjustments` (Fase 6 B2).
//
// Schema da tabela (do banco real, confirmado em B1.5):
//   id, user_id, adjustment_date, plan_id, plan_meal_id,
//   plan_slot_id, plan_option_id, option_item_id, adjusted_quantity_g
//   UNIQUE(user_id, adjustment_date, option_item_id)
//
// Semântica: "no dia X, dentro do slot Y do plano ativo, o user escolheu
// a alternativa Z (option Z, item Z) em vez da principal".
//
// Schema quirk (P22 do STATUS): o UNIQUE deveria ser em (user_id,
// adjustment_date, plan_slot_id) — UNIQUE em option_item_id permite 2+
// adjustments coexistirem no mesmo slot apontando pra options diferentes.
// Workaround neste arquivo: useSetAdjustment SEMPRE deleta adjustments
// existentes do mesmo (user, dia, slot) antes do INSERT. Garante "1
// adjustment ativo por slot" mesmo com o constraint sub-ótimo.
//
// Triggers do banco (cleanup) cuidam de DELETE em log_entries (off-plan)
// e log_meals — ver §2 do STATUS.

type PlanDayAdjustment =
  Database['public']['Tables']['plan_day_adjustments']['Row']

export function useDayAdjustments(dateISO: string) {
  const { user } = useAuth()
  const userId = user?.id

  return useQuery({
    queryKey: planKeys.adjustments(dateISO),
    enabled: !!userId && !!dateISO,
    queryFn: async (): Promise<PlanDayAdjustment[]> => {
      if (!userId) throw new Error('No user')
      const { data, error } = await supabase
        .from('plan_day_adjustments')
        .select('*')
        .eq('user_id', userId)
        .eq('adjustment_date', dateISO)
      if (error) throw error
      return (data ?? []) as PlanDayAdjustment[]
    },
  })
}

export interface SetAdjustmentInput {
  dateISO: string
  plan_id: string
  plan_meal_id: string
  plan_slot_id: string
  plan_option_id: string
  option_item_id: string
  adjusted_quantity_g: number
}

// Set: troca a alternativa ativa do slot pro dia. Sequência:
//   1. DELETE adjustments existentes do (user, dia, slot) — workaround P22
//   2. INSERT novo apontando pra option/item escolhidos
//
// Não-atômico (2 round-trips). Single-user single-tab não tem race —
// se virar problema (ex: 2 tabs abertas no mesmo dispositivo), trocar
// por RPC `set_day_adjustment(jsonb)`. Anotado como dívida em P22.
export function useSetAdjustment() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userId = user?.id

  return useMutation({
    mutationFn: async (input: SetAdjustmentInput) => {
      if (!userId) throw new Error('No user')

      const { error: delError } = await supabase
        .from('plan_day_adjustments')
        .delete()
        .eq('user_id', userId)
        .eq('adjustment_date', input.dateISO)
        .eq('plan_slot_id', input.plan_slot_id)
      if (delError) throw delError

      const { error: insError } = await supabase
        .from('plan_day_adjustments')
        .insert({
          user_id: userId,
          adjustment_date: input.dateISO,
          plan_id: input.plan_id,
          plan_meal_id: input.plan_meal_id,
          plan_slot_id: input.plan_slot_id,
          plan_option_id: input.plan_option_id,
          option_item_id: input.option_item_id,
          adjusted_quantity_g: input.adjusted_quantity_g,
        })
      if (insError) throw insError
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: planKeys.adjustments(vars.dateISO),
      })
    },
  })
}

export interface ClearAdjustmentInput {
  dateISO: string
  plan_slot_id: string
}

// Clear: volta o slot pro estado natural (alternativa principal do plano).
// DELETE por (user, dia, slot) — mesma chave do delete preventivo do
// useSetAdjustment, garante idempotência.
export function useClearAdjustment() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userId = user?.id

  return useMutation({
    mutationFn: async (input: ClearAdjustmentInput) => {
      if (!userId) throw new Error('No user')
      const { error } = await supabase
        .from('plan_day_adjustments')
        .delete()
        .eq('user_id', userId)
        .eq('adjustment_date', input.dateISO)
        .eq('plan_slot_id', input.plan_slot_id)
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: planKeys.adjustments(vars.dateISO),
      })
    },
  })
}
