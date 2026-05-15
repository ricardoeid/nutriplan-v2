import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

import { logKeys } from '../lib/query-keys'
import type {
  DailyLogPayload,
  EntryFoodSummary,
  LogEntryWithFood,
} from '../lib/types'

type LogEntryRow = Database['public']['Tables']['log_entries']['Row']

// Subset de food necessário pra criar uma entry. Inclui per-100g pra
// computar os macros snapshot da entry.
export interface AddEntryFoodInput {
  id: string
  name: string
  brand: string | null
  source: string
  serving_label: string | null
  default_serving_g: number
  kcal_per_100g: number
  protein_per_100g: number
  carb_per_100g: number
  fat_per_100g: number
}

interface AddEntryVars {
  mealId: string
  dateISO: string
  food: AddEntryFoodInput
  quantityG: number
}

// Arredonda pra 1 casa decimal. Match precisão guardada no banco
// (numeric) e display ("60.5 kcal"). Evita "60.66666 kcal" no toast.
function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// Mutation pra inserir uma log_entry. Snapshot pattern:
// log_entries.kcal/protein/carbs/fat são computados a partir do
// food.per_100g × quantity_g no momento do log. Mudar o food depois
// NÃO altera entries antigas (§4 do STATUS).
//
// Optimistic: insere entry com id temporário pra UI atualizar instantâneo.
// Totals do dia incrementam imediato — ring/barras sobem na hora.
// invalidate em onSettled substitui pelos valores reais do server.
//
// is_off_plan=false sempre na Fase 4. Quando Fase 5/6 vier com motor de
// substituição, esse flag começa a ser usado pra marcar entries que
// divergem do plano.
export function useAddEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      mealId,
      food,
      quantityG,
    }: AddEntryVars): Promise<LogEntryRow> => {
      const factor = quantityG / 100
      const kcal = round1(food.kcal_per_100g * factor)
      const protein = round1(food.protein_per_100g * factor)
      const carbs = round1(food.carb_per_100g * factor)
      const fat = round1(food.fat_per_100g * factor)

      const { data, error } = await supabase
        .from('log_entries')
        .insert({
          log_meal_id: mealId,
          food_id: food.id,
          quantity_g: quantityG,
          kcal,
          protein,
          carbs,
          fat,
          is_off_plan: false,
        })
        .select()
        .single()

      if (error) throw error

      // Bump use_count + last_used (P12 do STATUS — alimenta filtros
      // "Frequentes" e "Recentes" do /foods e ranking do search_foods).
      // Fire-and-forget: se a RPC falhar, a entry já foi criada — só
      // logamos pra triagem.
      //
      // Cast `as never` porque database.ts gerado ainda não conhece a
      // RPC nova (criada na migration 20260515090000). Regerar tipos
      // via `bunx supabase gen types` remove a necessidade. Anotado
      // como pendência pós-aplicação da migration.
      const { error: bumpError } = await supabase.rpc(
        'bump_food_use' as never,
        { p_food_id: food.id } as never,
      )
      if (bumpError) {
        console.warn('bump_food_use failed for', food.id, bumpError)
      }

      return data as LogEntryRow
    },

    onMutate: async ({ mealId, dateISO, food, quantityG }) => {
      await queryClient.cancelQueries({ queryKey: logKeys.daily(dateISO) })
      const prev = queryClient.getQueryData<DailyLogPayload>(
        logKeys.daily(dateISO),
      )
      if (!prev) return { prev: undefined }

      const factor = quantityG / 100
      const newEntryMacros = {
        kcal: round1(food.kcal_per_100g * factor),
        protein: round1(food.protein_per_100g * factor),
        carbs: round1(food.carb_per_100g * factor),
        fat: round1(food.fat_per_100g * factor),
      }

      const foodSummary: EntryFoodSummary = {
        id: food.id,
        name: food.name,
        brand: food.brand,
        source: food.source,
        serving_label: food.serving_label,
        default_serving_g: food.default_serving_g,
      }

      const newEntry: LogEntryWithFood = {
        id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        log_meal_id: mealId,
        food_id: food.id,
        quantity_g: quantityG,
        kcal: newEntryMacros.kcal,
        protein: newEntryMacros.protein,
        carbs: newEntryMacros.carbs,
        fat: newEntryMacros.fat,
        plan_slot_id: null,
        plan_option_id: null,
        is_off_plan: false,
        created_at: new Date().toISOString(),
        food: foodSummary,
      }

      const newMeals = prev.meals.map((m) =>
        m.id === mealId ? { ...m, entries: [...m.entries, newEntry] } : m,
      )

      const newTotals = {
        kcal: prev.totals.kcal + newEntryMacros.kcal,
        protein: prev.totals.protein + newEntryMacros.protein,
        carbs: prev.totals.carbs + newEntryMacros.carbs,
        fat: prev.totals.fat + newEntryMacros.fat,
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
    },
  })
}
