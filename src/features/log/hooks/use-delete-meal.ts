import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { planKeys } from '@/features/plans/lib/query-keys'

import { logKeys } from '../lib/query-keys'
import type { DailyLogPayload, DayTotals } from '../lib/types'

interface DeleteMealVars {
  mealId: string
  dateISO: string
}

// Mutation pra excluir uma log_meal inteira. Cascade do DB remove as
// log_entries vinculadas automaticamente (FK ON DELETE CASCADE). O
// optimistic update remove a meal da lista E subtrai a soma dos macros
// das entries dela dos totals do dia.
//
// RLS via ownership walker (get_log_meal_owner). Frontend não valida.
export function useDeleteMeal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ mealId }: DeleteMealVars) => {
      const { error } = await supabase
        .from('log_meals')
        .delete()
        .eq('id', mealId)
      if (error) throw error
    },

    onMutate: async ({ mealId, dateISO }) => {
      await queryClient.cancelQueries({ queryKey: logKeys.daily(dateISO) })

      const prev = queryClient.getQueryData<DailyLogPayload>(
        logKeys.daily(dateISO),
      )
      if (!prev) return { prev: undefined }

      // Encontra a meal removida pra somar seus macros e subtrair dos totals.
      const removedMeal = prev.meals.find((m) => m.id === mealId)
      const removedSum = removedMeal
        ? removedMeal.entries.reduce(
            (acc, e) => ({
              kcal: acc.kcal + Number(e.kcal),
              protein: acc.protein + Number(e.protein),
              carbs: acc.carbs + Number(e.carbs),
              fat: acc.fat + Number(e.fat),
            }),
            { kcal: 0, protein: 0, carbs: 0, fat: 0 },
          )
        : { kcal: 0, protein: 0, carbs: 0, fat: 0 }

      const newMeals = prev.meals.filter((m) => m.id !== mealId)

      const newTotals: DayTotals = {
        kcal: Math.max(prev.totals.kcal - removedSum.kcal, 0),
        protein: Math.max(prev.totals.protein - removedSum.protein, 0),
        carbs: Math.max(prev.totals.carbs - removedSum.carbs, 0),
        fat: Math.max(prev.totals.fat - removedSum.fat, 0),
      }

      queryClient.setQueryData<DailyLogPayload>(logKeys.daily(dateISO), {
        ...prev,
        meals: newMeals,
        totals: newTotals,
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
      // Triggers no banco (B6.1) limpam adjustments propagados em outras
      // refeições do dia quando uma log_meal com plan_meal_id é deletada.
      // Invalida o cache de adjustments pra refletir esse cleanup no
      // /plano e na Home (Esperado vs Comido).
      queryClient.invalidateQueries({
        queryKey: planKeys.adjustments(vars.dateISO),
      })
    },
  })
}
