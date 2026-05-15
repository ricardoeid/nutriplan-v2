import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

import { logKeys } from '../lib/query-keys'
import type { AddEntryFoodInput } from './use-add-entry'

// Entry input pra batch insert. Mesmo formato do AddEntryVars do
// useAddEntry (singular), mas sem dateISO em cada (vem no envelope) e
// com campos opcionais pra entries vinculadas ao plano (plan_slot_id,
// plan_option_id, is_off_plan).
export interface AddEntryItem {
  mealId: string
  food: AddEntryFoodInput
  quantityG: number
  planSlotId?: string | null
  planOptionId?: string | null
  isOffPlan?: boolean
}

interface AddEntriesVars {
  dateISO: string
  entries: AddEntryItem[]
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// Mutation pra inserir VÁRIAS log_entries de uma vez (Fase 6 B3).
//
// Diferenças do useAddEntry singular:
//   1. Batch INSERT (1 round-trip), não loop de chamadas.
//   2. Aceita plan_slot_id / plan_option_id pra entries vindas do plano
//      (Registrar esta refeição). useAddEntry sempre seta null nesses.
//   3. Sem optimistic update — adicionar N entries com IDs temporários
//      ao cache + computar totais é frágil em batch. Invalidate em
//      onSettled cobre bem; insert batch é rápido (~200ms típico) e o
//      user fica na tela do sheet até o callback de sucesso.
//
// bump_food_use (resolve P12): chamado depois do INSERT pra cada food
// distinto. Fire-and-forget no sentido de "não derruba o sucesso se
// bump falhar" — entries já entraram, contador atualizado é polish.
// Se bumps falharem sistematicamente (ex: RPC ausente), logamos via
// console.warn pra triagem.
//
// Snapshot pattern (§4 STATUS): kcal/protein/carbs/fat computados aqui
// e congelados na row. Mudar o food depois NÃO altera entries antigas.
export function useAddEntries() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ entries }: AddEntriesVars) => {
      if (entries.length === 0) return

      const rows = entries.map((e) => {
        const factor = e.quantityG / 100
        return {
          log_meal_id: e.mealId,
          food_id: e.food.id,
          quantity_g: e.quantityG,
          kcal: round1(e.food.kcal_per_100g * factor),
          protein: round1(e.food.protein_per_100g * factor),
          carbs: round1(e.food.carb_per_100g * factor),
          fat: round1(e.food.fat_per_100g * factor),
          plan_slot_id: e.planSlotId ?? null,
          plan_option_id: e.planOptionId ?? null,
          is_off_plan: e.isOffPlan ?? false,
        }
      })

      const { error: insError } = await supabase
        .from('log_entries')
        .insert(rows)
      if (insError) throw insError

      // Bump use_count + last_used pra cada food distinto.
      // Cast `as never` — database.ts gerado ainda não conhece a RPC
      // nova (criada na migration 20260515090000). Após aplicar +
      // regerar tipos, casts saem.
      const distinctFoodIds = [...new Set(entries.map((e) => e.food.id))]
      for (const foodId of distinctFoodIds) {
        const { error: bumpError } = await supabase.rpc(
          'bump_food_use' as never,
          { p_food_id: foodId } as never,
        )
        if (bumpError) {
          console.warn('bump_food_use failed for', foodId, bumpError)
        }
      }
    },
    onSettled: (_data, _error, vars) => {
      queryClient.invalidateQueries({
        queryKey: logKeys.daily(vars.dateISO),
      })
    },
  })
}
