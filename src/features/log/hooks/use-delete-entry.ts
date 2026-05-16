import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { planKeys } from '@/features/plans/lib/query-keys'

import { logKeys } from '../lib/query-keys'
import type { DailyLogPayload, DayTotals } from '../lib/types'

interface DeleteEntryVars {
  entryId: string
  // Necessário pra invalidar a chave certa do cache (logKeys.daily depende da data).
  dateISO: string
}

// Mutation pra excluir uma log_entry. Optimistic update remove a entry
// da lista da meal pai E subtrai os macros do daily totals — UI atualiza
// instantâneo. onError faz rollback completo via snapshot.
//
// RLS no log_entries usa ownership walker (get_log_meal_owner em §3 do
// STATUS) pra garantir que só o dono delete. Frontend não precisa
// validar — banco bloqueia.
//
// Sem undo no B5 por simplicidade. Re-criar uma entry com mesmo ID
// requer dados extras e timing — fica pra Fase 5 se Ricardo pedir.
export function useDeleteEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ entryId }: DeleteEntryVars) => {
      const { error } = await supabase
        .from('log_entries')
        .delete()
        .eq('id', entryId)
      if (error) throw error
    },

    onMutate: async ({ entryId, dateISO }) => {
      await queryClient.cancelQueries({ queryKey: logKeys.daily(dateISO) })

      const prev = queryClient.getQueryData<DailyLogPayload>(
        logKeys.daily(dateISO),
      )
      if (!prev) return { prev: undefined }

      // Find + filter num pass só. Captura os macros removidos pra
      // subtrair dos totals. Default zero — se entry não foi encontrada
      // (race muito improvável), subtração vira no-op.
      //
      // Nota TS: variável mutada dentro de callback NÃO funciona com
      // narrowing `| null`, TS marca como `never` no escopo externo.
      // Solução: tipar sempre como DayTotals com default 0.
      const removedMacros: DayTotals = {
        kcal: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      }

      const newMeals = prev.meals.map((meal) => {
        const filtered = meal.entries.filter((e) => {
          if (e.id === entryId) {
            removedMacros.kcal = Number(e.kcal)
            removedMacros.protein = Number(e.protein)
            removedMacros.carbs = Number(e.carbs)
            removedMacros.fat = Number(e.fat)
            return false
          }
          return true
        })
        return { ...meal, entries: filtered }
      })

      const newTotals: DayTotals = {
        kcal: Math.max(prev.totals.kcal - removedMacros.kcal, 0),
        protein: Math.max(prev.totals.protein - removedMacros.protein, 0),
        carbs: Math.max(prev.totals.carbs - removedMacros.carbs, 0),
        fat: Math.max(prev.totals.fat - removedMacros.fat, 0),
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
      // Reconcilia com servidor. Garante consistência caso o optimistic
      // tenha divergido por race (improvável em delete simples).
      queryClient.invalidateQueries({ queryKey: logKeys.daily(vars.dateISO) })
      // Triggers no banco (B6.1) limpam adjustments propagados em
      // outras refeições do dia quando uma entry off-plan é deletada.
      // Invalida o cache de adjustments pra refletir esse cleanup no
      // /plano e na Home (Esperado vs Comido).
      queryClient.invalidateQueries({
        queryKey: planKeys.adjustments(vars.dateISO),
      })
    },
  })
}
