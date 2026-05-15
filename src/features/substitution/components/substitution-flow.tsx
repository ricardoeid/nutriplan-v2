import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { FoodSearchResult } from '@/features/foods/lib/types'
import type { LogMealWithEntries } from '@/features/log/lib/types'
import type {
  PlanTreeMealRaw,
  PlanTreeOptionRaw,
  PlanTreeSlotRaw,
} from '@/features/plans/lib/draft-types'
import type { Database } from '@/types/database'

import { foodMacrosAtQty } from '@/features/plans/lib/option-macros'
import { runSubstitution } from '../lib/engine'
import type {
  Macros,
  SubstitutionFood,
  SubstitutionInput,
  SubstitutionItem,
  SubstitutionMeal,
  SubstitutionResult,
} from '../lib/types'
import {
  useApplySubstitution,
  type ApplyFutureAdjustment,
  type ApplyEntry,
  type ApplySubstitutionPayload,
  type ApplyTargetAdjustment,
} from '../hooks/use-apply-substitution'
import { SubstitutionFoodStep } from './substitution-food-step'
import { SubstitutionReviewSheet } from './substitution-review-sheet'
import {
  SubstitutionCommitSheet,
  findItemAdjustmentByKey,
} from './substitution-commit-sheet'

type PlanDayAdjustment =
  Database['public']['Tables']['plan_day_adjustments']['Row']

interface SubstitutionFlowProps {
  // Controla visibilidade do flow inteiro. Quando false, todos os
  // sheets ficam escondidos.
  open: boolean
  onOpenChange: (open: boolean) => void

  // Contexto do plano e dia (vindo do PlanoPage).
  planId: string
  todayISO: string
  dayTargets: Macros
  dailyLogId: string
  // Log_meal_id correspondente à plan_meal-alvo no daily_log de hoje
  // (vindo do useTodaysPlan).
  targetLogMealId: string

  // Refeição-alvo: plan_meal completo do tree.
  targetPlanMeal: PlanTreeMealRaw
  // Refeições futuras (cronológica > target, ainda não logadas).
  // Filtragem feita pelo caller pra manter o flow ignorante de detalhes.
  futurePlanMeals: PlanTreeMealRaw[]

  // Overlay de adjustments (B2) — pra resolver opções ATIVAS na
  // refeição-alvo e futuras quando montar SubstitutionInput.
  adjustmentsBySlotId: Map<string, PlanDayAdjustment>

  // Refeições do dailyLog (do useDailyLog) — usadas pra computar
  // consumedSoFar (macros já registradas em refeições OUTRAS que não
  // target/futures).
  dailyLogMeals: LogMealWithEntries[]
}

// Controller dos 3 steps do flow "Quero comer outra coisa" (Fase 6 B6):
//   step 'food'   → SubstitutionFoodStep (picker + qty)
//   step 'review' → SubstitutionReviewSheet (diff + warnings + confirm)
//   step 'commit' → SubstitutionCommitSheet (checkboxes pré-marcados +
//                   registrar refeição → RPC apply_substitution)
//
// Mantém state interno: chosenFood, chosenQty, result (do engine).
// Caller (PlanoPage) só sabe open/close.
//
// onConfirm final dispara useApplySubstitution; toast de sucesso/erro;
// fecha flow inteiro em sucesso (caller observa via onOpenChange).
export function SubstitutionFlow({
  open,
  onOpenChange,
  planId,
  todayISO,
  dayTargets,
  dailyLogId,
  targetLogMealId,
  targetPlanMeal,
  futurePlanMeals,
  adjustmentsBySlotId,
  dailyLogMeals,
}: SubstitutionFlowProps) {
  const [step, setStep] = useState<'food' | 'review' | 'commit'>('food')
  const [chosenFood, setChosenFood] = useState<FoodSearchResult | null>(null)
  const [chosenQty, setChosenQty] = useState<number>(0)
  const apply = useApplySubstitution()

  // Reset quando o flow abre.
  useMemo(() => {
    if (open) {
      setStep('food')
      setChosenFood(null)
      setChosenQty(0)
    }
  }, [open])

  // Map auxiliar: engineItemKey → {slotId, optionId, itemId} pra montar
  // payload da RPC sem perder referências. Engine usa SubstitutionItem.id
  // que aqui é uma composição "slotId:optionId:itemId" — quando o engine
  // devolve adjustments com itemId, lookup direto.
  const engineItemKeyMap = useMemo(() => {
    const map = new Map<
      string,
      { slotId: string; optionId: string; itemId: string }
    >()
    for (const slot of targetPlanMeal.slots) {
      const adj = adjustmentsBySlotId.get(slot.id)
      const opt = pickActiveOption(slot, adj)
      const item = opt?.items[0]
      if (!opt || !item) continue
      const key = makeEngineItemKey(slot.id, opt.id, item.id)
      map.set(key, { slotId: slot.id, optionId: opt.id, itemId: item.id })
    }
    for (const meal of futurePlanMeals) {
      for (const slot of meal.slots) {
        const adj = adjustmentsBySlotId.get(slot.id)
        const opt = pickActiveOption(slot, adj)
        const item = opt?.items[0]
        if (!opt || !item) continue
        const key = makeEngineItemKey(slot.id, opt.id, item.id)
        map.set(key, { slotId: slot.id, optionId: opt.id, itemId: item.id })
      }
    }
    return map
  }, [targetPlanMeal, futurePlanMeals, adjustmentsBySlotId])

  // Plan_meal_id por engineItemKey (pra propagation precisar do meal_id
  // da futura no payload).
  const planMealIdByItemKey = useMemo(() => {
    const map = new Map<string, string>()
    for (const slot of targetPlanMeal.slots) {
      const adj = adjustmentsBySlotId.get(slot.id)
      const opt = pickActiveOption(slot, adj)
      const item = opt?.items[0]
      if (!opt || !item) continue
      map.set(makeEngineItemKey(slot.id, opt.id, item.id), targetPlanMeal.id)
    }
    for (const meal of futurePlanMeals) {
      for (const slot of meal.slots) {
        const adj = adjustmentsBySlotId.get(slot.id)
        const opt = pickActiveOption(slot, adj)
        const item = opt?.items[0]
        if (!opt || !item) continue
        map.set(makeEngineItemKey(slot.id, opt.id, item.id), meal.id)
      }
    }
    return map
  }, [targetPlanMeal, futurePlanMeals, adjustmentsBySlotId])

  // Map mealId → SubstitutionMeal (passado ao review sheet pra exibir
  // nomes das futuras).
  const futureMealsByMealId = useMemo(() => {
    const map = new Map<string, SubstitutionMeal>()
    for (const meal of futurePlanMeals) {
      const subMeal = planMealToSubstitutionMeal(meal, adjustmentsBySlotId)
      if (subMeal.items.length > 0) map.set(meal.id, subMeal)
    }
    return map
  }, [futurePlanMeals, adjustmentsBySlotId])

  // Roda engine quando user proceedeu do food step.
  const result: SubstitutionResult | null = useMemo(() => {
    if (!chosenFood || chosenQty <= 0) return null

    const consumedSoFar = computeConsumedSoFar(
      dailyLogMeals,
      targetLogMealId,
      futurePlanMeals.map((m) => m.id),
    )

    const input: SubstitutionInput = {
      targetMeal: planMealToSubstitutionMeal(targetPlanMeal, adjustmentsBySlotId),
      futureMeals: futurePlanMeals
        .map((m) => planMealToSubstitutionMeal(m, adjustmentsBySlotId))
        .filter((m) => m.items.length > 0),
      chosen: {
        food: foodSearchResultToSubstitutionFood(chosenFood),
        quantity_g: chosenQty,
      },
      day: { consumedSoFar, dayTargets },
    }

    return runSubstitution(input)
  }, [
    chosenFood,
    chosenQty,
    dailyLogMeals,
    targetLogMealId,
    futurePlanMeals,
    targetPlanMeal,
    adjustmentsBySlotId,
    dayTargets,
  ])

  if (!open) return null

  // ─── Step 1: food picker ────────────────────────────────────────
  if (step === 'food') {
    return (
      <SubstitutionFoodStep
        open={open}
        onOpenChange={onOpenChange}
        targetMealName={targetPlanMeal.name}
        onProceed={(food, qty) => {
          setChosenFood(food)
          setChosenQty(qty)
          setStep('review')
        }}
      />
    )
  }

  // ─── Step 2: review ─────────────────────────────────────────────
  if (step === 'review' && result) {
    return (
      <SubstitutionReviewSheet
        open={open}
        onOpenChange={onOpenChange}
        result={result}
        targetMealName={targetPlanMeal.name}
        futureMealsByMealId={futureMealsByMealId}
        onConfirm={() => setStep('commit')}
        onCancel={() => onOpenChange(false)}
      />
    )
  }

  // ─── Step 3: commit ─────────────────────────────────────────────
  if (step === 'commit' && result) {
    return (
      <>
        {/* Review sheet permanece atrás (visualmente semitransparente
            via z-index e bg do commit sheet menor). Não precisa
            re-renderizar — caller observa open. */}
        <SubstitutionReviewSheet
          open={true}
          onOpenChange={() => {}}
          result={result}
          targetMealName={targetPlanMeal.name}
          futureMealsByMealId={futureMealsByMealId}
          onConfirm={() => setStep('commit')}
          onCancel={() => onOpenChange(false)}
          submitting={apply.isPending}
        />
        <SubstitutionCommitSheet
          open={true}
          onOpenChange={onOpenChange}
          result={result}
          targetMealName={targetPlanMeal.name}
          submitting={apply.isPending}
          onBack={() => setStep('review')}
          onConfirm={async (selection) => {
            try {
              const payload = buildApplyPayload({
                result,
                selection,
                targetLogMealId,
                todayISO,
                planId,
                targetPlanMealId: targetPlanMeal.id,
                planMealIdByItemKey,
                engineItemKeyMap,
                dailyLogId,
              })
              void dailyLogId // pra TS não acusar unused se buildApplyPayload mudar
              await apply.mutateAsync({ dateISO: todayISO, payload })
              toast.success('Substituição registrada')
              onOpenChange(false)
            } catch (err) {
              toast.error('Falha ao registrar substituição. Tente novamente.')
              throw err
            }
          }}
        />
      </>
    )
  }

  return null
}

// ─── Helpers de conversão e overlay ──────────────────────────────────

// Monta engine item key composto. Engine usa SubstitutionItem.id como
// identificador opaco — aqui usamos string composta pra recuperar
// slot/option/item ids depois sem map externo.
function makeEngineItemKey(
  slotId: string,
  optionId: string,
  itemId: string,
): string {
  return `${slotId}:${optionId}:${itemId}`
}

function pickActiveOption(
  slot: PlanTreeSlotRaw,
  adjustment: PlanDayAdjustment | undefined,
): PlanTreeOptionRaw | undefined {
  const sorted = [...slot.options].sort((a, b) => a.sort_order - b.sort_order)
  if (sorted.length === 0) return undefined
  if (!adjustment) return sorted[0]
  return sorted.find((o) => o.id === adjustment.plan_option_id) ?? sorted[0]
}

function planMealToSubstitutionMeal(
  meal: PlanTreeMealRaw,
  adjustmentsBySlotId: Map<string, PlanDayAdjustment>,
): SubstitutionMeal {
  const items: SubstitutionItem[] = []
  for (const slot of meal.slots) {
    const adj = adjustmentsBySlotId.get(slot.id)
    const opt = pickActiveOption(slot, adj)
    const item = opt?.items[0]
    if (!opt || !item) continue
    const qty = adj
      ? Number(adj.adjusted_quantity_g)
      : Number(item.quantity_g)
    items.push({
      id: makeEngineItemKey(slot.id, opt.id, item.id),
      food: foodToSubstitutionFood(item.food),
      quantity_g: qty,
    })
  }
  return {
    id: meal.id,
    name: meal.name,
    target_time: meal.target_time,
    items,
  }
}

function foodToSubstitutionFood(food: {
  id: string
  name: string
  brand: string | null
  source: string
  kcal_per_100g: number
  protein_per_100g: number
  carb_per_100g: number
  fat_per_100g: number
  default_serving_g: number
  recalc_whole_units_only: boolean
}): SubstitutionFood {
  return {
    id: food.id,
    name: food.name,
    brand: food.brand,
    source: food.source,
    kcal_per_100g: Number(food.kcal_per_100g),
    protein_per_100g: Number(food.protein_per_100g),
    carb_per_100g: Number(food.carb_per_100g),
    fat_per_100g: Number(food.fat_per_100g),
    default_serving_g: Number(food.default_serving_g),
    recalc_whole_units_only: food.recalc_whole_units_only,
  }
}

function foodSearchResultToSubstitutionFood(
  food: FoodSearchResult,
): SubstitutionFood {
  return {
    id: food.id,
    name: food.name,
    brand: food.brand,
    source: String(food.source),
    kcal_per_100g: Number(food.kcal_per_100g),
    protein_per_100g: Number(food.protein_per_100g),
    carb_per_100g: Number(food.carb_per_100g),
    fat_per_100g: Number(food.fat_per_100g),
    default_serving_g: Number(food.default_serving_g),
    recalc_whole_units_only: food.recalc_whole_units_only,
  }
}

// Macros consumidas hoje em refeições QUE NÃO SÃO target nem futuras.
// Caller passa log_meals do daily_log + target log_meal_id + lista de
// plan_meal_ids futuros. Filtra e soma.
function computeConsumedSoFar(
  dailyLogMeals: LogMealWithEntries[],
  targetLogMealId: string,
  futurePlanMealIds: string[],
): Macros {
  const futureSet = new Set(futurePlanMealIds)
  return dailyLogMeals.reduce<Macros>(
    (acc, meal) => {
      if (meal.id === targetLogMealId) return acc
      if (meal.plan_meal_id && futureSet.has(meal.plan_meal_id)) return acc
      for (const entry of meal.entries) {
        acc.kcal += Number(entry.kcal)
        acc.protein += Number(entry.protein)
        acc.carbs += Number(entry.carbs)
        acc.fat += Number(entry.fat)
      }
      return acc
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

// ─── Payload builder ────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function buildApplyPayload(args: {
  result: SubstitutionResult
  selection: { entries: Array<{ key: string; isOffPlan: boolean; foodId: string; quantityG: number; kcal: number; protein: number; carbs: number; fat: number }> }
  targetLogMealId: string
  todayISO: string
  planId: string
  targetPlanMealId: string
  planMealIdByItemKey: Map<string, string>
  engineItemKeyMap: Map<
    string,
    { slotId: string; optionId: string; itemId: string }
  >
  dailyLogId: string
}): ApplySubstitutionPayload {
  const {
    result,
    selection,
    targetLogMealId,
    todayISO,
    planId,
    targetPlanMealId,
    planMealIdByItemKey,
    engineItemKeyMap,
  } = args

  // 1. target_entries: chosen + items selecionados da refeição-alvo
  const target_entries: ApplyEntry[] = selection.entries.map((row) => {
    if (row.key === 'chosen') {
      return {
        food_id: row.foodId,
        quantity_g: row.quantityG,
        kcal: round1(row.kcal),
        protein: round1(row.protein),
        carbs: round1(row.carbs),
        fat: round1(row.fat),
        plan_slot_id: null,
        plan_option_id: null,
        is_off_plan: true,
      }
    }
    // Items da refeição-alvo: recuperar slot/option ids via key
    const adj = findItemAdjustmentByKey(result, row.key)
    const itemKey = adj?.itemId ?? ''
    const refs = engineItemKeyMap.get(itemKey)
    return {
      food_id: row.foodId,
      quantity_g: row.quantityG,
      kcal: round1(row.kcal),
      protein: round1(row.protein),
      carbs: round1(row.carbs),
      fat: round1(row.fat),
      plan_slot_id: refs?.slotId ?? null,
      plan_option_id: refs?.optionId ?? null,
      is_off_plan: false,
    }
  })

  // 2. target_adjustments: TODOS os items originais da refeição-alvo
  //    (inclusive zerados — replace semantics no banco).
  const target_adjustments: ApplyTargetAdjustment[] = []
  for (const adj of result.targetMealAdjustments.itemAdjustments) {
    const refs = engineItemKeyMap.get(adj.itemId)
    if (!refs) continue
    target_adjustments.push({
      plan_slot_id: refs.slotId,
      plan_option_id: refs.optionId,
      option_item_id: refs.itemId,
      adjusted_quantity_g: round1(adj.adjustedQuantityG),
    })
  }

  // 3. future_adjustments: items das refeições futuras com qty alterada
  const future_adjustments: ApplyFutureAdjustment[] = []
  for (const fma of result.futureMealsAdjustments) {
    for (const adj of fma.itemAdjustments) {
      const refs = engineItemKeyMap.get(adj.itemId)
      if (!refs) continue
      // Só persiste se houve mudança real (otimiza tabela)
      if (
        Math.abs(adj.adjustedQuantityG - adj.originalQuantityG) < 0.01
      ) {
        continue
      }
      const mealId = planMealIdByItemKey.get(adj.itemId) ?? fma.mealId
      future_adjustments.push({
        plan_meal_id: mealId,
        plan_slot_id: refs.slotId,
        plan_option_id: refs.optionId,
        option_item_id: refs.itemId,
        adjusted_quantity_g: round1(adj.adjustedQuantityG),
      })
    }
  }

  // 4. food_ids_to_bump: distinct
  const foodIds = new Set<string>()
  for (const e of selection.entries) foodIds.add(e.foodId)

  return {
    log_meal_id: targetLogMealId,
    adjustment_date: todayISO,
    plan_id: planId,
    plan_meal_id: targetPlanMealId,
    target_entries,
    target_adjustments,
    future_adjustments,
    food_ids_to_bump: [...foodIds],
  }
}

// Ref consumida pra TS não pegar nada como unused
void foodMacrosAtQty
