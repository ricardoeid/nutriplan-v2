import type {
  ItemAdjustment,
  Macros,
  MealAdjustment,
  PreservationStrategy,
  SubstitutionFood,
  SubstitutionInput,
  SubstitutionItem,
  SubstitutionMeal,
  SubstitutionResult,
  SubstitutionWarnings,
} from './types'

// Motor de substituição protein-aware (Fase 6 B5).
//
// Réplica do Apêndice 11 do blueprint V2, que por sua vez deriva da
// engine real do V1 (Lovable). Decisões mantidas:
//   - 3 estratégias (preserve-protein / neutral / reduce-protein)
//     baseadas em chosenProteinPct vs target.protein
//   - Propagação do excesso pras refeições futuras com MESMA estratégia
//   - Whole-units stepwise pra foods com recalc_whole_units_only (ovos)
//   - 3 warnings (proteinBelowFloor, calorieAboveCeiling, excessNotFullyAbsorbed)
//
// Função pura — sem I/O, sem side effects. Caller (B6) monta o input
// a partir de plan tree + adjustments + dailyLog e traduz o resultado
// em UI/persistência.

// ─── Constantes ─────────────────────────────────────────────────────

export const PRESERVE_PROTEIN_THRESHOLD = 0.3
export const REDUCE_PROTEIN_THRESHOLD = 0.8
export const PROTEIN_PRESERVE_FACTOR = 0.7
export const MIN_DIVISIBLE_GRAMS = 10
export const EXCESS_ABSORPTION_KCAL_THRESHOLD = 50
export const EXCESS_ABSORPTION_PCT_THRESHOLD = 1.02
export const CALORIE_CEILING_TOLERANCE = 0.1
export const PROTEIN_FLOOR_TOLERANCE = 0.1

// Frações permitidas pra items unit-labeled mas NÃO whole-units-only
// (ex: "1 fatia de pão"). Snap pelo mais próximo. Whole-units-only
// (ovos) NÃO usa essa lista — sempre múltiplo inteiro de default_serving_g.
const ALLOWED_UNIT_FRACTIONS = [
  0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5,
]

// ─── Helpers de macros ──────────────────────────────────────────────

export function foodMacros(food: SubstitutionFood, qtyG: number): Macros {
  const factor = qtyG / 100
  return {
    kcal: food.kcal_per_100g * factor,
    protein: food.protein_per_100g * factor,
    carbs: food.carb_per_100g * factor,
    fat: food.fat_per_100g * factor,
  }
}

function itemMacros(item: SubstitutionItem): Macros {
  return foodMacros(item.food, item.quantity_g)
}

function sumMacros(arr: Macros[]): Macros {
  return arr.reduce<Macros>(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

function mealMacros(items: SubstitutionItem[]): Macros {
  return sumMacros(items.map(itemMacros))
}

// kcal de uma row ajustada (food + qty ajustada).
function adjustmentKcal(adj: ItemAdjustment): number {
  return foodMacros(adj.food, adj.adjustedQuantityG).kcal
}

function adjustmentMacros(adj: ItemAdjustment): Macros {
  return foodMacros(adj.food, adj.adjustedQuantityG)
}

// ─── roundQty ───────────────────────────────────────────────────────
//
// Para whole-units-only: arredonda PARA BAIXO em múltiplos inteiros de
// default_serving_g (decisão V1 — determinístico, evita "3.5 ovos virou
// 4" inesperado).
// Para unit-labeled mas não whole-units-only: snap pra fração permitida
// mais próxima em unidades. (Implementação simplificada — V2 não usa
// serving_label de modo significativo no engine; pode evoluir se Ricardo
// pedir.)
// Para outros foods: retorna qty arredondada pra 1 casa decimal.
function roundQty(food: SubstitutionFood, rawG: number): number {
  if (rawG <= 0) return 0
  if (food.recalc_whole_units_only) {
    const units = Math.floor(rawG / food.default_serving_g)
    return units * food.default_serving_g
  }
  // Default: 1 casa decimal pra evitar "73.412g" no display.
  return Math.round(rawG * 10) / 10
}

// Snap pra fração permitida mais próxima (usado por unit-labeled
// futuro). Hoje não é chamado — kept pra completude.
function snapToFraction(rawUnits: number): number {
  let best = ALLOWED_UNIT_FRACTIONS[0]
  let bestDist = Math.abs(rawUnits - best)
  for (const f of ALLOWED_UNIT_FRACTIONS) {
    const d = Math.abs(rawUnits - f)
    if (d < bestDist) {
      best = f
      bestDist = d
    }
  }
  return best
}
// Mantém referência pra TS não acusar unused.
void snapToFraction

// ─── topProteinIndex ────────────────────────────────────────────────
//
// Índice do item com MAIOR proteína absoluta na refeição (protein per
// 100g × qty). Empate: primeiro na ordem. Refeição vazia: -1.
function topProteinIndex(items: SubstitutionItem[]): number {
  let bestIdx = -1
  let bestProtein = -Infinity
  for (let i = 0; i < items.length; i++) {
    const p = itemMacros(items[i]).protein
    if (p > bestProtein) {
      bestProtein = p
      bestIdx = i
    }
  }
  return bestIdx
}

// ─── reduceMealToBudget ─────────────────────────────────────────────
//
// Corta `kcalToReduce` kcal dos items da refeição, respeitando a
// estratégia. Retorna ItemAdjustment[] (1 por item, mesma ordem da
// entrada). Items com qty 0 = "removidos".
//
// Algoritmo:
//   1. Identifica top-protein item.
//   2. Calcula targetReduction por item baseado em estratégia:
//      - neutral: proporcional ao kcal de cada
//      - preserve-protein: top × baseFraction × 0.7; resto absorve o
//        leftover proporcional
//      - reduce-protein: top × baseFraction × 1.43 (1/0.7) clampado a
//        topKcal; resto absorve leftover
//   3. Aplica reduções via applyKcalReduction (qty cai até cobrir, ou
//      vira 0 se cair abaixo de MIN_DIVISIBLE_GRAMS).
//   4. Pra whole-units-only items, roundQty arredonda pra baixo →
//      "pass corretivo" tenta tirar resíduo dos outros se sobrou.
export function reduceMealToBudget(
  items: SubstitutionItem[],
  kcalToReduce: number,
  strategy: PreservationStrategy,
): ItemAdjustment[] {
  // Sem nada a cortar OU lista vazia: passa direto sem mudança.
  if (kcalToReduce <= 0 || items.length === 0) {
    return items.map((item) => ({
      itemId: item.id,
      food: item.food,
      originalQuantityG: item.quantity_g,
      adjustedQuantityG: item.quantity_g,
    }))
  }

  const macros = items.map(itemMacros)
  const totalKcal = macros.reduce((s, m) => s + m.kcal, 0)
  if (totalKcal <= 0) {
    // Refeição com 0 kcal? Edge case defensivo — retorna sem mudança.
    return items.map((item) => ({
      itemId: item.id,
      food: item.food,
      originalQuantityG: item.quantity_g,
      adjustedQuantityG: item.quantity_g,
    }))
  }

  // Se kcalToReduce >= totalKcal, zera tudo.
  if (kcalToReduce >= totalKcal) {
    return items.map((item) => ({
      itemId: item.id,
      food: item.food,
      originalQuantityG: item.quantity_g,
      adjustedQuantityG: 0,
    }))
  }

  const baseFraction = kcalToReduce / totalKcal
  const topIdx = topProteinIndex(items)

  // Pra cada item, calcula kcal-a-cortar baseado em estratégia.
  let topReduction = 0
  let leftover = kcalToReduce
  if (strategy === 'preserve-protein' && topIdx !== -1) {
    const topKcal = macros[topIdx].kcal
    topReduction = Math.min(topKcal, topKcal * baseFraction * PROTEIN_PRESERVE_FACTOR)
    leftover = kcalToReduce - topReduction
  } else if (strategy === 'reduce-protein' && topIdx !== -1) {
    const topKcal = macros[topIdx].kcal
    topReduction = Math.min(topKcal, topKcal * baseFraction * (1 / PROTEIN_PRESERVE_FACTOR))
    leftover = kcalToReduce - topReduction
  }

  // Soma kcal dos non-top items (pra distribuir leftover proporcional)
  let nonTopTotalKcal = 0
  for (let i = 0; i < macros.length; i++) {
    if (i === topIdx && (strategy === 'preserve-protein' || strategy === 'reduce-protein')) {
      continue
    }
    nonTopTotalKcal += macros[i].kcal
  }

  // Aplica reduções
  const adjustments: ItemAdjustment[] = items.map((item, i) => {
    const m = macros[i]
    let cutKcal: number
    if (strategy === 'preserve-protein' || strategy === 'reduce-protein') {
      if (i === topIdx) {
        cutKcal = topReduction
      } else {
        cutKcal = nonTopTotalKcal > 0 ? leftover * (m.kcal / nonTopTotalKcal) : 0
      }
    } else {
      // neutral: proporcional puro ao kcal
      cutKcal = kcalToReduce * (m.kcal / totalKcal)
    }
    // Clampa: não cortar mais do que o item tem
    cutKcal = Math.min(cutKcal, m.kcal)

    // Converte cutKcal → nova qty
    const newQty = applyKcalReductionToItem(item, m.kcal, cutKcal)
    return {
      itemId: item.id,
      food: item.food,
      originalQuantityG: item.quantity_g,
      adjustedQuantityG: newQty,
    }
  })

  // Pass corretivo: se whole-units arredondou pra baixo e sobrou cut
  // não-aplicado, tenta tirar mais dos divisíveis com sobra. (Best-effort:
  // se ainda assim não absorver, residualExcess captura no caller.)
  const realCut = adjustments.reduce(
    (s, adj, i) => s + (macros[i].kcal - adjustmentKcal(adj)),
    0,
  )
  const missingCut = kcalToReduce - realCut
  if (missingCut > 0.5) {
    // Tenta absorver nos divisíveis ainda > 0
    for (let i = 0; i < adjustments.length && missingCut > 0.5; i++) {
      const adj = adjustments[i]
      if (adj.food.recalc_whole_units_only) continue
      if (adj.adjustedQuantityG <= 0) continue
      const availableKcal = adjustmentKcal(adj)
      if (availableKcal <= 0) continue
      const cutMore = Math.min(missingCut, availableKcal)
      const newQty = applyKcalReductionToItem(
        { ...items[i], quantity_g: adj.adjustedQuantityG },
        availableKcal,
        cutMore,
      )
      adjustments[i] = { ...adj, adjustedQuantityG: newQty }
      // recompute missingCut
      const newCut = adjustments.reduce(
        (s, a, j) => s + (macros[j].kcal - adjustmentKcal(a)),
        0,
      )
      const remainingMissing = kcalToReduce - newCut
      if (remainingMissing <= 0.5) break
    }
  }

  return adjustments
}

// Aplica corte de `cutKcal` em um item específico. Retorna nova qty (g).
//
// Whole-units-only: arredonda pra baixo em múltiplos inteiros (V1 doc
// confirma: `Math.floor(rawG / default_serving_g)`).
// Divisíveis: reduz qty proporcional ao kcal cortado; se nova qty <
// MIN_DIVISIBLE_GRAMS, vira 0 (item "removido").
function applyKcalReductionToItem(
  item: SubstitutionItem,
  itemKcalNow: number,
  cutKcal: number,
): number {
  if (cutKcal <= 0) return item.quantity_g
  if (itemKcalNow <= 0) return item.quantity_g
  const ratio = cutKcal / itemKcalNow
  const newRawQty = item.quantity_g * (1 - ratio)
  const newQty = roundQty(item.food, newRawQty)
  // Pra divisíveis, se cair abaixo do mínimo, vira 0.
  if (!item.food.recalc_whole_units_only && newQty < MIN_DIVISIBLE_GRAMS && newQty > 0) {
    return 0
  }
  return Math.max(0, newQty)
}

// ─── runSubstitution ────────────────────────────────────────────────

export function runSubstitution(input: SubstitutionInput): SubstitutionResult {
  const { targetMeal, futureMeals, chosen, day } = input

  // 1. Macros do chosen
  const chosenMacros = foodMacros(chosen.food, chosen.quantity_g)

  // 2. Macros e proteína da refeição-alvo
  const targetMealMacros = mealMacros(targetMeal.items)
  const targetTotalKcal = targetMealMacros.kcal
  const targetTotalProtein = targetMealMacros.protein

  // 3. Estratégia: chosenProteinPct = chosen.protein / target.protein
  //    Caso edge: target.protein === 0 → reduce-protein (qualquer chosen
  //    com proteína é "muito" comparado a 0).
  let chosenProteinPct: number
  if (targetTotalProtein <= 0) {
    chosenProteinPct = chosenMacros.protein > 0 ? Infinity : 0
  } else {
    chosenProteinPct = chosenMacros.protein / targetTotalProtein
  }

  let strategy: PreservationStrategy
  if (chosenProteinPct < PRESERVE_PROTEIN_THRESHOLD) {
    strategy = 'preserve-protein'
  } else if (chosenProteinPct < REDUCE_PROTEIN_THRESHOLD) {
    strategy = 'neutral'
  } else {
    strategy = 'reduce-protein'
  }

  // 4. Ajustar refeição-alvo. Se chosen.kcal >= target.kcal, zera tudo
  //    e gera excess = chosen.kcal - target.kcal. Senão, corta `chosen.kcal`
  //    dos items pra abrir espaço (preserva o esperado total da refeição:
  //    items_ajustados + chosen ≈ target_original).
  let targetItemAdjustments: ItemAdjustment[]
  let excess = 0
  const gap = chosenMacros.kcal - targetTotalKcal
  if (gap >= 0) {
    targetItemAdjustments = targetMeal.items.map((item) => ({
      itemId: item.id,
      food: item.food,
      originalQuantityG: item.quantity_g,
      adjustedQuantityG: 0,
    }))
    excess = gap
  } else {
    // kcalToReduce = chosen.kcal (= -gap quando chosen cabe na refeição)
    // — não confundir com "espaço restante pros items" (que seria target -
    // chosen). reduceMealToBudget tem semântica "cut amount", não "budget
    // target". Bug histórico: chamar com -gap aqui resultava em cortes
    // proporcionais errados (quase zerava a refeição mesmo pra chosens
    // pequenos).
    targetItemAdjustments = reduceMealToBudget(
      targetMeal.items,
      chosenMacros.kcal,
      strategy,
    )
    // Calcula se sobrou excesso por arredondamento (pass corretivo
    // pode não ter conseguido absorver tudo se whole-units forçou).
    const actualCut = targetMeal.items.reduce((s, item, i) => {
      const adj = targetItemAdjustments[i]
      return s + itemMacros(item).kcal - adjustmentKcal(adj)
    }, 0)
    const needed = chosenMacros.kcal
    const unabsorbed = needed - actualCut
    if (unabsorbed > 0) excess = unabsorbed
  }

  // 5. Propagação pras futuras (B7 — filtra excludedFutureMealIds antes).
  // Futuras NÃO excluídas (= elegíveis) absorvem excess proporcional.
  // Futuras excluídas ficam intactas (qty original) — share que iria
  // pra elas vira residualExcess.
  const excludedSet = input.excludedFutureMealIds ?? new Set<string>()
  const eligibleFutures = futureMeals.filter((m) => !excludedSet.has(m.id))
  let futureMealsAdjustments: MealAdjustment[] = []
  let residualExcess = excess

  if (excess > 0 && eligibleFutures.length > 0) {
    const futureKcals = eligibleFutures.map((m) => mealMacros(m.items).kcal)
    const totalFutureKcal = futureKcals.reduce((a, b) => a + b, 0)
    if (totalFutureKcal > 0) {
      const shares = futureKcals.map((k) => excess * (k / totalFutureKcal))
      let absorbedTotal = 0
      futureMealsAdjustments = eligibleFutures.map((meal, i) => {
        const share = shares[i]
        const adj = reduceMealToBudget(meal.items, share, strategy)
        const cut = meal.items.reduce(
          (s, item, j) => s + itemMacros(item).kcal - adjustmentKcal(adj[j]),
          0,
        )
        absorbedTotal += cut
        return { mealId: meal.id, itemAdjustments: adj }
      })
      residualExcess = Math.max(0, excess - absorbedTotal)
    }
    // se totalFutureKcal === 0 (todas elegíveis vazias), residualExcess
    // fica = excess. Idem se eligibleFutures vazio.
  }

  // 6. Totais finais do dia
  // Mapa mealId → MealAdjustment pra distinguir futuras AJUSTADAS de
  // futuras INTACTAS (excluídas ou sem propagação).
  const adjustedFutureMealIds = new Set(
    futureMealsAdjustments.map((fma) => fma.mealId),
  )
  const finalTargetMacros = sumMacros(
    targetItemAdjustments.map(adjustmentMacros),
  )
  const finalFuturesMacros = sumMacros(
    futureMealsAdjustments.flatMap((fma) =>
      fma.itemAdjustments.map(adjustmentMacros),
    ),
  )
  // Futuras intactas: aquelas em futureMeals que NÃO receberam adjustment
  // (excluídas pelo user OU caso totalFutureKcal === 0). Seus items
  // permanecem na qty original.
  const unchangedFuturesMacros = sumMacros(
    futureMeals
      .filter((m) => !adjustedFutureMealIds.has(m.id))
      .flatMap((m) => m.items.map(itemMacros)),
  )

  const newDayTotals: Macros = {
    kcal:
      day.consumedSoFar.kcal +
      finalTargetMacros.kcal +
      chosenMacros.kcal +
      finalFuturesMacros.kcal +
      unchangedFuturesMacros.kcal,
    protein:
      day.consumedSoFar.protein +
      finalTargetMacros.protein +
      chosenMacros.protein +
      finalFuturesMacros.protein +
      unchangedFuturesMacros.protein,
    carbs:
      day.consumedSoFar.carbs +
      finalTargetMacros.carbs +
      chosenMacros.carbs +
      finalFuturesMacros.carbs +
      unchangedFuturesMacros.carbs,
    fat:
      day.consumedSoFar.fat +
      finalTargetMacros.fat +
      chosenMacros.fat +
      finalFuturesMacros.fat +
      unchangedFuturesMacros.fat,
  }

  // 7. Warnings
  const calorieAboveCeiling =
    day.dayTargets.kcal > 0 &&
    newDayTotals.kcal > day.dayTargets.kcal * (1 + CALORIE_CEILING_TOLERANCE)
  const proteinBelowFloor =
    day.dayTargets.protein > 0 &&
    newDayTotals.protein < day.dayTargets.protein * (1 - PROTEIN_FLOOR_TOLERANCE)
  const excessNotFullyAbsorbed =
    residualExcess > EXCESS_ABSORPTION_KCAL_THRESHOLD &&
    day.dayTargets.kcal > 0 &&
    newDayTotals.kcal > day.dayTargets.kcal * EXCESS_ABSORPTION_PCT_THRESHOLD

  const warnings: SubstitutionWarnings = {
    proteinBelowFloor,
    calorieAboveCeiling,
    excessNotFullyAbsorbed,
  }

  // 8. Pcts
  const kcalPctOfTarget =
    day.dayTargets.kcal > 0 ? (newDayTotals.kcal / day.dayTargets.kcal) * 100 : 0
  const proteinPctOfTarget =
    day.dayTargets.protein > 0
      ? (newDayTotals.protein / day.dayTargets.protein) * 100
      : 0

  return {
    targetMealAdjustments: {
      mealId: targetMeal.id,
      itemAdjustments: targetItemAdjustments,
    },
    futureMealsAdjustments,
    chosen: {
      food: chosen.food,
      quantityG: chosen.quantity_g,
      macros: chosenMacros,
    },
    newDayTotals,
    dayTargets: day.dayTargets,
    kcalPctOfTarget,
    proteinPctOfTarget,
    preservationStrategy: strategy,
    residualExcessKcal: residualExcess,
    warnings,
  }
}

// Helper: aceita um SubstitutionMeal e retorna o macro total da
// alternativa ativa (caller já resolveu overlay com adjustments).
// Re-exportado por conveniência pros testes / B6.
export function getMealTotals(meal: SubstitutionMeal): Macros {
  return mealMacros(meal.items)
}
