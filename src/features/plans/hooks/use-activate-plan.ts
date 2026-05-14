import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { getTodayBR } from '@/lib/dates'
import { logKeys } from '@/features/log/lib/query-keys'

import { planKeys } from '../lib/query-keys'

// Ativa um plano. O RPC `activate_meal_plan` no banco já cuida de:
//   1. Desativar o plano ativo anterior (UNIQUE partial em is_active=true)
//   2. Marcar este como is_active=true
//   3. Cleanup-and-seed do daily_log de HOJE:
//      - Deleta log_meals vazias que não pertencem ao plano novo
//      - Insere log_meals novas (idempotente via NOT EXISTS)
//      - Mantém log_meals com entries (não destrói histórico do user)
//      - Atualiza daily_logs.plan_id
//
// Por isso invalidamos tanto a lista de planos (is_active mudou em
// vários rows) quanto o diário de hoje (refeições podem ter mudado).
//
// Caveat conhecido (P16): o RPC usa CURRENT_DATE (UTC), enquanto o
// cliente usa getTodayBR (timezone São Paulo). Entre 21h-23:59 BR já
// é dia seguinte UTC — nesses horários, o cleanup-and-seed pode rodar
// num daily_log que não existe ainda e o seed não acontece. Não trava
// nada (get_or_create_daily_log resolve quando user abrir o dia), mas
// fica anotado.
//
// Sem optimistic update: a operação envolve mexer em várias rows de
// várias tabelas; o ganho de feedback imediato não compensa a
// complexidade de espelhar tudo client-side. Loading state simples
// na UI cobre bem.
export function useActivatePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase.rpc('activate_meal_plan', {
        p_plan_id: planId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planKeys.list() })
      queryClient.invalidateQueries({ queryKey: logKeys.daily(getTodayBR()) })
    },
  })
}
