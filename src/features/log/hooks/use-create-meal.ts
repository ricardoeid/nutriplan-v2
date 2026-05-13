import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

import { logKeys } from '../lib/query-keys'
import type { DailyLogPayload, LogMealWithEntries } from '../lib/types'

type LogMealRow = Database['public']['Tables']['log_meals']['Row']

interface CreateMealVars {
  dailyLogId: string
  dateISO: string
  name: string
  // HH:MM (input type="time" devolve nesse formato) ou undefined.
  // O banco aceita time as NULL.
  target_time?: string
}

// Mutation pra criar uma log_meal manual (sem plan_meal_id).
//
// sort_order: max atual + 1, pra aparecer no fim da lista. Para empty
// state (0 refeições), começa em 0.
//
// Optimistic: cria row com id temporário pra UI renderizar instantâneo.
// invalidateQueries em onSettled substitui pelo row real do server.
export function useCreateMeal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      dailyLogId,
      name,
      target_time,
    }: CreateMealVars): Promise<LogMealRow> => {
      // sort_order = max existente + 1. Server-side via subselect evita
      // race condition se múltiplas inserções batem ao mesmo tempo
      // (improvável em uso real, mas barato cobrir).
      const { data: existing, error: queryError } = await supabase
        .from('log_meals')
        .select('sort_order')
        .eq('daily_log_id', dailyLogId)
        .order('sort_order', { ascending: false })
        .limit(1)

      if (queryError) throw queryError
      const nextSortOrder = (existing?.[0]?.sort_order ?? -1) + 1

      const { data, error } = await supabase
        .from('log_meals')
        .insert({
          daily_log_id: dailyLogId,
          name,
          sort_order: nextSortOrder,
          target_time: target_time ?? null,
        })
        .select()
        .single()

      if (error) throw error
      return data as LogMealRow
    },

    onMutate: async ({ dailyLogId, dateISO, name, target_time }) => {
      await queryClient.cancelQueries({ queryKey: logKeys.daily(dateISO) })
      const prev = queryClient.getQueryData<DailyLogPayload>(
        logKeys.daily(dateISO),
      )
      if (!prev) return { prev: undefined }

      const nextSortOrder =
        prev.meals.length > 0
          ? Math.max(...prev.meals.map((m) => m.sort_order)) + 1
          : 0

      // ID temporário com prefixo. invalidate substitui pelo real.
      const tempId = `temp-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`

      const newMeal: LogMealWithEntries = {
        id: tempId,
        daily_log_id: dailyLogId,
        name,
        sort_order: nextSortOrder,
        plan_meal_id: null,
        target_time: target_time ?? null,
        eaten_at: null,
        created_at: new Date().toISOString(),
        entries: [],
      }

      queryClient.setQueryData<DailyLogPayload>(logKeys.daily(dateISO), {
        ...prev,
        meals: [...prev.meals, newMeal].sort(
          (a, b) => a.sort_order - b.sort_order,
        ),
      })
      return { prev }
    },

    onError: (_error, vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(logKeys.daily(vars.dateISO), context.prev)
      }
    },

    onSettled: (_data, _error, vars) => {
      queryClient.invalidateQueries({ queryKey: logKeys.daily(vars.dateISO) })
    },
  })
}
