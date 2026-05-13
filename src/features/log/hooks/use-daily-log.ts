import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/hooks/useAuth'

import { logKeys } from '../lib/query-keys'
import type {
  DailyLog,
  DailyLogPayload,
  DayTotals,
  LogMealWithEntries,
  LogEntryWithFood,
} from '../lib/types'

// Hook do diário diário. Carrega o `daily_log` da data + todas as refeições
// + todas as entries + nome do alimento de cada entry, em 1 RPC + 1 select
// aninhado.
//
// Flow:
//   1. RPC `get_or_create_daily_log(p_date)` retorna o uuid do daily_log
//      (cria se não existe, idempotente — semeia 6 refeições default ou
//      copia do plano ativo).
//   2. SELECT aninhado em `daily_logs` puxa: snapshots dos targets +
//      log_meals (com entries com food).
//   3. Ordena log_meals por sort_order, log_entries por created_at,
//      soma totals client-side.
//
// Decisões de tipagem:
//   - Cast `as unknown as` no resultado do select aninhado porque o
//     tipo gerado pelo Supabase pra nested selects não é confiável
//     (mesma lição do §3.5 do STATUS aplicada a `foods`).
//   - `dateISO` é YYYY-MM-DD (string), não Date. Caller produz no
//     timezone correto (BR — daily_logs.log_date não tem default, é
//     sempre passado explícito; ver app's getTodayBR no B3).
//
// Retorno segue padrão amigável (regra 4 §3 do STATUS): objeto com
// nomes claros, não o cru do TanStack Query.
export function useDailyLog(dateISO: string) {
  const { user } = useAuth()
  const userId = user?.id

  const result = useQuery({
    queryKey: logKeys.daily(dateISO),
    enabled: !!userId && !!dateISO,
    queryFn: async (): Promise<DailyLogPayload> => {
      if (!userId) throw new Error('No user')

      // Step 1: idempotente — cria ou retorna existente.
      const { data: dailyLogId, error: rpcError } = await supabase.rpc(
        'get_or_create_daily_log',
        { p_date: dateISO }
      )
      if (rpcError) throw rpcError
      if (!dailyLogId) throw new Error('RPC returned no daily_log id')

      // Step 2: select aninhado com nullability honesta.
      // Lista explícita de colunas em vez de '*' pra deixar claro o
      // contrato e evitar payload inflado se o schema crescer.
      const { data, error } = await supabase
        .from('daily_logs')
        .select(
          `
          id, user_id, log_date, plan_id,
          calorie_target_snapshot, protein_target_snapshot,
          carb_target_snapshot, fat_target_snapshot,
          created_at,
          log_meals (
            id, daily_log_id, name, sort_order, plan_meal_id,
            target_time, eaten_at, created_at,
            log_entries (
              id, log_meal_id, food_id, quantity_g,
              kcal, protein, carbs, fat,
              plan_slot_id, plan_option_id, is_off_plan, created_at,
              food:foods (
                id, name, brand, source, serving_label, default_serving_g
              )
            )
          )
        `
        )
        .eq('id', dailyLogId)
        .single()

      if (error) throw error
      if (!data) throw new Error('daily_log not found after RPC')

      // Reshape: ordena meals/entries + computa totals.
      const raw = data as unknown as DailyLog & {
        log_meals: Array<LogMealWithEntries & { log_entries: LogEntryWithFood[] }>
      }

      const meals: LogMealWithEntries[] = (raw.log_meals ?? [])
        .map((meal) => ({
          ...meal,
          entries: [...(meal.log_entries ?? [])].sort((a, b) =>
            a.created_at.localeCompare(b.created_at)
          ),
        }))
        .sort((a, b) => a.sort_order - b.sort_order)

      const totals: DayTotals = meals.reduce<DayTotals>(
        (acc, meal) => {
          for (const entry of meal.entries) {
            acc.kcal += Number(entry.kcal)
            acc.protein += Number(entry.protein)
            acc.carbs += Number(entry.carbs)
            acc.fat += Number(entry.fat)
          }
          return acc
        },
        { kcal: 0, protein: 0, carbs: 0, fat: 0 }
      )

      // Strip log_meals raw field — usuário do hook consome `meals`.
      const { log_meals: _omit, ...dailyLogOnly } = raw
      void _omit

      return {
        dailyLog: dailyLogOnly as DailyLog,
        meals,
        totals,
      }
    },
  })

  return {
    dailyLog: result.data?.dailyLog,
    meals: result.data?.meals ?? [],
    totals: result.data?.totals ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    loading: result.isLoading,
    fetching: result.isFetching,
    error: result.error,
  }
}
