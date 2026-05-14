import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { getTodayBR } from '@/lib/dates'
import { useDailyLog } from '@/features/log/hooks/use-daily-log'
import type { LogEntryWithFood } from '@/features/log/lib/types'

import { planKeys } from '../lib/query-keys'
import type { PlanTreeResponse } from '../lib/draft-types'

// Hook do /plano (B6). Combina:
//   1. useDailyLog(hoje) — pega o daily_log de hoje + descobre se há
//      plan_id (plano ativo no momento da criação do daily_log).
//   2. get_plan_tree(plan_id) — se há plan_id, busca o tree completo.
//
// Por que via daily_log e não via meal_plans.is_active=true:
//   - `daily_logs.plan_id` é o snapshot do plano que estava ativo
//     quando o dia começou. Mantém consistência se user trocar de
//     plano no meio do dia (raro, mas possível).
//   - `activate_meal_plan` RPC sincroniza `daily_logs.plan_id` quando
//     ativa, então os dois ficam alinhados.
//
// Estados retornados:
//   - loading: ainda buscando daily_log ou tree
//   - error: falha em qualquer um dos fetches
//   - hasActivePlan: daily_log.plan_id != null
//   - planTree: a árvore completa (plan + meals + slots + options +
//     items + food info), null se não há plano ativo
//
// Cache compartilhado: o tree usa a mesma queryKey do editor
// (planKeys.tree(planId)). Se user editar o plano e salvar, /plano
// reflete imediatamente (sem refetch extra) graças à invalidação do
// useSavePlan.
export function useTodaysPlan() {
  const today = getTodayBR()
  const dailyLogQuery = useDailyLog(today)

  const planId = dailyLogQuery.dailyLog?.plan_id ?? null

  const planTreeQuery = useQuery({
    queryKey: planKeys.tree(planId ?? undefined),
    enabled: !!planId,
    queryFn: async (): Promise<PlanTreeResponse | null> => {
      if (!planId) return null
      const { data, error } = await supabase.rpc('get_plan_tree', {
        p_plan_id: planId,
      })
      if (error) throw error
      return (data ?? null) as unknown as PlanTreeResponse | null
    },
  })

  // Mapa plan_meal_id → entries da refeição do diário de hoje. Fase 6 B1
  // usa pra decidir o estado visual da refeição no /plano (past-eaten vs
  // past-empty/future). log_meals sem plan_meal_id (refeições manuais)
  // ficam fora do mapa — não casam com nenhuma refeição do plano.
  const entriesByPlanMealId = useMemo(() => {
    const map = new Map<string, LogEntryWithFood[]>()
    for (const meal of dailyLogQuery.meals) {
      if (!meal.plan_meal_id) continue
      map.set(meal.plan_meal_id, meal.entries)
    }
    return map
  }, [dailyLogQuery.meals])

  return {
    planTree: planTreeQuery.data ?? null,
    hasActivePlan: !!planId,
    entriesByPlanMealId,
    loading: dailyLogQuery.loading || planTreeQuery.isLoading,
    fetching: dailyLogQuery.fetching || planTreeQuery.isFetching,
    error: dailyLogQuery.error ?? planTreeQuery.error,
  }
}
