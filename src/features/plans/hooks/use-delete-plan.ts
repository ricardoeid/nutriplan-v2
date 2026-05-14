import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { getTodayBR } from '@/lib/dates'
import { logKeys } from '@/features/log/lib/query-keys'

import { planKeys } from '../lib/query-keys'

// Deleta um plano. Cascade do banco remove plan_meals → plan_slots →
// slot_options → option_items em sequência.
//
// Sobre o daily_log de hoje: se o plano deletado era o ativo, as
// log_meals já criadas pra hoje com plan_meal_id apontando pras
// plan_meals removidas viram `plan_meal_id NULL` (assumindo FK ON
// DELETE SET NULL) ou o cascade derruba elas — em qualquer caso, o
// diário de hoje fica afetado. Invalidamos pra refletir o que quer
// que o banco tenha decidido.
//
// Sem optimistic: delete é ação destrutiva, melhor confirmar no
// servidor antes de remover da UI. A lista é curta (poucos planos
// por user), refetch é barato.
//
// Mutation vive no parent (rota /planos) — Regra 14 do STATUS, porque
// o card que dispara some da lista no sucesso (delete-self).
export function useDeletePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase
        .from('meal_plans')
        .delete()
        .eq('id', planId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planKeys.list() })
      queryClient.invalidateQueries({ queryKey: logKeys.daily(getTodayBR()) })
    },
  })
}
