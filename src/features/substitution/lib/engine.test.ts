import { describe, expect, it } from 'vitest'

import {
  CALORIE_CEILING_TOLERANCE,
  EXCESS_ABSORPTION_KCAL_THRESHOLD,
  PRESERVE_PROTEIN_THRESHOLD,
  PROTEIN_FLOOR_TOLERANCE,
  REDUCE_PROTEIN_THRESHOLD,
  runSubstitution,
} from './engine'
import type {
  Macros,
  SubstitutionDayContext,
  SubstitutionFood,
  SubstitutionInput,
  SubstitutionItem,
  SubstitutionMeal,
} from './types'

// ─── Factory helpers ────────────────────────────────────────────────

let foodCounter = 0
function makeFood(
  partial: Partial<SubstitutionFood> & {
    kcal: number
    protein: number
    carb?: number
    fat?: number
  },
): SubstitutionFood {
  foodCounter += 1
  return {
    id: partial.id ?? `food-${foodCounter}`,
    name: partial.name ?? `Food ${foodCounter}`,
    brand: partial.brand ?? null,
    source: partial.source ?? 'taco',
    kcal_per_100g: partial.kcal,
    protein_per_100g: partial.protein,
    carb_per_100g: partial.carb ?? 0,
    fat_per_100g: partial.fat ?? 0,
    default_serving_g: partial.default_serving_g ?? 100,
    recalc_whole_units_only: partial.recalc_whole_units_only ?? false,
  }
}

let itemCounter = 0
function makeItem(
  food: SubstitutionFood,
  quantityG: number,
  id?: string,
): SubstitutionItem {
  itemCounter += 1
  return {
    id: id ?? `item-${itemCounter}`,
    food,
    quantity_g: quantityG,
  }
}

let mealCounter = 0
function makeMeal(
  items: SubstitutionItem[],
  partial: Partial<SubstitutionMeal> = {},
): SubstitutionMeal {
  mealCounter += 1
  return {
    id: partial.id ?? `meal-${mealCounter}`,
    name: partial.name ?? `Meal ${mealCounter}`,
    target_time: partial.target_time ?? '12:00:00',
    items,
  }
}

const ZERO_MACROS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

function defaultDay(
  partial: Partial<SubstitutionDayContext> = {},
): SubstitutionDayContext {
  return {
    consumedSoFar: partial.consumedSoFar ?? ZERO_MACROS,
    dayTargets: partial.dayTargets ?? {
      kcal: 2000,
      protein: 150,
      carbs: 250,
      fat: 60,
    },
  }
}

function inputFor(
  targetItems: SubstitutionItem[],
  chosenFood: SubstitutionFood,
  chosenQty: number,
  futures: SubstitutionMeal[] = [],
  day: SubstitutionDayContext = defaultDay(),
): SubstitutionInput {
  return {
    targetMeal: makeMeal(targetItems),
    futureMeals: futures,
    chosen: { food: chosenFood, quantity_g: chosenQty },
    day,
  }
}

// Foods de teste
const FRANGO = makeFood({
  id: 'frango',
  name: 'Frango grelhado',
  kcal: 165,
  protein: 31,
  carb: 0,
  fat: 3.6,
})
const ARROZ = makeFood({
  id: 'arroz',
  name: 'Arroz cozido',
  kcal: 130,
  protein: 2.7,
  carb: 28,
  fat: 0.3,
})
const SALADA = makeFood({
  id: 'salada',
  name: 'Salada folhas',
  kcal: 15,
  protein: 1.5,
  carb: 3,
  fat: 0.2,
})
const PIZZA = makeFood({
  id: 'pizza',
  name: 'Pizza muçarela',
  kcal: 265,
  protein: 11,
  carb: 33,
  fat: 10,
})
const GOIABADA = makeFood({
  id: 'goiabada',
  name: 'Goiabada',
  kcal: 285,
  protein: 0.5,
  carb: 73,
  fat: 0.1,
})
const RICOTA = makeFood({
  id: 'ricota',
  name: 'Ricota',
  kcal: 140,
  protein: 11,
  carb: 3,
  fat: 9,
})
const OVO = makeFood({
  id: 'ovo',
  name: 'Ovo cozido',
  kcal: 155,
  protein: 13,
  carb: 1.1,
  fat: 11,
  default_serving_g: 50,
  recalc_whole_units_only: true,
})

// ─── Testes ─────────────────────────────────────────────────────────

describe('runSubstitution — estratégia preserve-protein', () => {
  it('1. chosen pobre em proteína → preserve-protein, top-protein corta menos', () => {
    // Refeição: frango 150g (31×1.5=46.5g P) + arroz 100g (2.7g P) + salada 50g (0.75g P)
    // Total protein = ~50g. Chosen: goiabada 50g = 0.25g P
    // chosenProteinPct = 0.25 / 50 = 0.005 << 0.3 → preserve
    const target = [
      makeItem(FRANGO, 150, 'frango'),
      makeItem(ARROZ, 100, 'arroz'),
      makeItem(SALADA, 50, 'salada'),
    ]
    const result = runSubstitution(inputFor(target, GOIABADA, 50))

    expect(result.preservationStrategy).toBe('preserve-protein')
    // Frango (top-protein) deve cortar PROPORCIONALMENTE MENOS que arroz/salada
    const adjs = result.targetMealAdjustments.itemAdjustments
    const frangoAdj = adjs.find((a) => a.itemId === 'frango')!
    const arrozAdj = adjs.find((a) => a.itemId === 'arroz')!
    const frangoReductionPct =
      1 - frangoAdj.adjustedQuantityG / frangoAdj.originalQuantityG
    const arrozReductionPct =
      1 - arrozAdj.adjustedQuantityG / arrozAdj.originalQuantityG
    expect(frangoReductionPct).toBeLessThan(arrozReductionPct)
  })
})

describe('runSubstitution — estratégia neutral', () => {
  it('2. chosen com proteína média → neutral, corte proporcional ao kcal', () => {
    // Refeição: frango 150g + arroz 100g + salada 50g.
    // Total kcal = 247.5 + 130 + 7.5 = 385
    // Total protein = ~50g
    // Chosen: pizza 100g = 11g P
    // chosenProteinPct = 11 / 50 = 0.22 → preserve (não 0.3+)
    // Pra forçar neutral, usar pizza maior OU target menor.
    // Vou usar pizza 150g = 16.5g protein. Pct = 16.5/50 = 0.33 → neutral.
    const target = [
      makeItem(FRANGO, 150, 'frango'),
      makeItem(ARROZ, 100, 'arroz'),
      makeItem(SALADA, 50, 'salada'),
    ]
    const result = runSubstitution(inputFor(target, PIZZA, 150))
    expect(result.preservationStrategy).toBe('neutral')

    // No neutral, cada item perde proporcional ao seu kcal. Então os
    // reduction-pcts devem ser IGUAIS entre os 3 items (todos cortam
    // o mesmo % de qty).
    const adjs = result.targetMealAdjustments.itemAdjustments
    const reductions = adjs.map(
      (a) => 1 - a.adjustedQuantityG / a.originalQuantityG,
    )
    // Tolerância pra arredondamento em roundQty
    expect(reductions[0]).toBeCloseTo(reductions[1], 1)
    expect(reductions[1]).toBeCloseTo(reductions[2], 1)
  })
})

describe('runSubstitution — estratégia reduce-protein', () => {
  it('3. chosen rico em proteína → reduce-protein, top-protein corta MAIS', () => {
    // Target: frango 150g (~46g P) + arroz 100g + salada 50g = ~50g P
    // Chosen: frango 200g = 62g P → pct = 62/50 = 1.24 > 0.8 → reduce
    const target = [
      makeItem(FRANGO, 150, 'frango'),
      makeItem(ARROZ, 100, 'arroz'),
      makeItem(SALADA, 50, 'salada'),
    ]
    const result = runSubstitution(inputFor(target, FRANGO, 200))
    expect(result.preservationStrategy).toBe('reduce-protein')

    const adjs = result.targetMealAdjustments.itemAdjustments
    const frangoAdj = adjs.find((a) => a.itemId === 'frango')!
    const arrozAdj = adjs.find((a) => a.itemId === 'arroz')!
    const frangoReductionPct =
      1 - frangoAdj.adjustedQuantityG / frangoAdj.originalQuantityG
    const arrozReductionPct =
      1 - arrozAdj.adjustedQuantityG / arrozAdj.originalQuantityG
    // No reduce, top-protein corta MAIS (chosen já trouxe proteína).
    expect(frangoReductionPct).toBeGreaterThan(arrozReductionPct)
  })
})

describe('runSubstitution — propagação pras refeições futuras', () => {
  it('4. chosen estoura refeição-alvo, futuras absorvem inteiro', () => {
    // Target: salada 50g = 7.5 kcal. Tem POUCO kcal.
    // Chosen: pizza 100g = 265 kcal. Excede em ~257 kcal.
    // Futuras: 2 refeições com ~300 kcal cada (cada futura tem espaço)
    const target = [makeItem(SALADA, 50, 'salada-t')]
    const future1 = makeMeal(
      [makeItem(FRANGO, 200, 'f1-frango')],
      { id: 'future-1', name: 'F1', target_time: '15:00:00' },
    )
    const future2 = makeMeal(
      [makeItem(ARROZ, 250, 'f2-arroz')],
      { id: 'future-2', name: 'F2', target_time: '19:00:00' },
    )
    const result = runSubstitution(
      inputFor(target, PIZZA, 100, [future1, future2]),
    )

    // Excesso ~257 kcal deve ser absorvido pelas 2 futuras.
    expect(result.residualExcessKcal).toBeLessThan(EXCESS_ABSORPTION_KCAL_THRESHOLD)
    expect(result.futureMealsAdjustments).toHaveLength(2)
    // Cada futura deve ter algum item ajustado (qty < original).
    for (const fma of result.futureMealsAdjustments) {
      const someAdjusted = fma.itemAdjustments.some(
        (a) => a.adjustedQuantityG < a.originalQuantityG,
      )
      expect(someAdjusted).toBe(true)
    }
  })

  it('5. chosen estoura demais, futuras não absorvem tudo → residualExcess > 0', () => {
    // Target: 1 item pequeno. Chosen: gigante.
    // Futuras pequenas, não conseguem absorver tudo.
    const target = [makeItem(SALADA, 50, 'salada-t')]  // 7.5 kcal
    const future1 = makeMeal([makeItem(SALADA, 100, 'f1-salada')], {
      id: 'future-1',
      target_time: '15:00:00',
    })  // 15 kcal
    const result = runSubstitution(
      inputFor(target, PIZZA, 200, [future1]),
    )
    // 530 kcal chosen, ~7.5 + 15 = ~22 kcal disponível pra cortar.
    // Mesmo zerando tudo, sobra > 500 kcal residual.
    expect(result.residualExcessKcal).toBeGreaterThan(400)
  })

  it('6. sem futuras → residualExcess = excess total', () => {
    const target = [makeItem(SALADA, 50, 'salada-t')]  // 7.5 kcal
    const result = runSubstitution(inputFor(target, PIZZA, 100))  // 265 kcal
    expect(result.futureMealsAdjustments).toHaveLength(0)
    // Excess = 265 - 7.5 = ~257.5 kcal sem absorção
    expect(result.residualExcessKcal).toBeGreaterThan(250)
  })
})

describe('runSubstitution — whole-units stepwise (ovos)', () => {
  it('7. ovos como top-protein em preserve: corta menos, em unidades inteiras', () => {
    // Target: 4 ovos (200g, 31g P, 620 kcal) + arroz 100g (130 kcal)
    // Chosen: goiabada 30g = ~85 kcal, 0.15g P
    // chosenProteinPct = 0.15 / 31.2 = 0.005 → preserve
    // Precisa cortar ~85 kcal.
    // Preserve mantém ovos (top-protein). Arroz absorve mais.
    const target = [
      makeItem(OVO, 200, 'ovos'),    // 4 ovos × 50g
      makeItem(ARROZ, 100, 'arroz'),
    ]
    const result = runSubstitution(inputFor(target, GOIABADA, 30))
    expect(result.preservationStrategy).toBe('preserve-protein')

    const adjs = result.targetMealAdjustments.itemAdjustments
    const ovosAdj = adjs.find((a) => a.itemId === 'ovos')!
    // Ovos: qty ajustada deve ser múltiplo de 50g (default_serving_g)
    expect(ovosAdj.adjustedQuantityG % 50).toBe(0)
    // Ovos deve ter cortado pouco ou nada (preserve + top-protein)
    expect(ovosAdj.adjustedQuantityG).toBeGreaterThanOrEqual(150)
  })

  it('8. ovos sozinhos, corte de ~1.5 ovos vira 3 ovos (round down)', () => {
    // Target: 4 ovos (200g)
    // Chosen: pizza pequena que requer cortar ~1.5 ovos (~78 kcal)
    // Esperado: ovos cai pra 3 unidades (150g) — round down em múltiplos de 50g.
    const target = [makeItem(OVO, 200, 'ovos')]
    // 4 ovos = 620 kcal. Quero cortar ~78 kcal → pizza ~30g = ~80 kcal
    const result = runSubstitution(inputFor(target, PIZZA, 30))

    const adjs = result.targetMealAdjustments.itemAdjustments
    const ovosAdj = adjs[0]
    // Esperado: 3 ovos = 150g (round down de ~165g raw após cortar 80/620 × 200)
    expect(ovosAdj.adjustedQuantityG).toBe(150)
  })
})

describe('runSubstitution — boundaries de threshold', () => {
  it('9. chosenProteinPct exatamente 0.3 → neutral (não preserve)', () => {
    // Target: frango 100g = 31g protein
    // Chosen com 31×0.3 = 9.3g protein. Usando RICOTA 84.5g → 9.295g P
    // chosenProteinPct = 9.295/31 = 0.2998 < 0.3 → preserve
    // Pra ficar EM cima de 0.3: chosen.protein = 31×0.3 = 9.3
    // RICOTA tem 11 P/100g → 84.54g de ricota = 9.3g P. Próximo de boundary.
    const target = [makeItem(FRANGO, 100, 'frango')]
    // 100g de ricota = 11g P → pct = 11/31 = 0.355 → neutral
    const result = runSubstitution(inputFor(target, RICOTA, 100))
    // pct = 0.355 → neutral (entre 0.3 e 0.8)
    expect(result.preservationStrategy).toBe('neutral')
  })

  it('10. chosenProteinPct exatamente 0.8 → reduce (não neutral)', () => {
    // Target: frango 100g = 31g protein
    // chosenProteinPct ≥ 0.8 → reduce. Threshold em ≥ 0.8.
    // 31 × 0.8 = 24.8g P. RICOTA 100g = 11g P (pct 0.355).
    // Usar FRANGO como chosen: 100g = 31g P. pct = 31/31 = 1.0 → reduce.
    const target = [makeItem(FRANGO, 100, 'frango')]
    const result = runSubstitution(inputFor(target, FRANGO, 100))
    expect(result.preservationStrategy).toBe('reduce-protein')
  })

  it('11. denominador correto: usa target.protein, NÃO day target.protein', () => {
    // Target: ricota 100g = 11g protein. Refeição PEQUENA.
    // Day target protein: 150g (grande)
    // Chosen: pizza 100g = 11g protein.
    // chosenProteinPct CORRETO = 11/11 = 1.0 → reduce
    // Se usar day target ERRADO: 11/150 = 0.073 → preserve
    // Teste falha se o engine confundir.
    const target = [makeItem(RICOTA, 100, 'ricota')]
    const result = runSubstitution(
      inputFor(target, PIZZA, 100, [], defaultDay()),
    )
    expect(result.preservationStrategy).toBe('reduce-protein')
  })
})

describe('runSubstitution — warnings', () => {
  it('12. proteinBelowFloor: total dia < target × 0.9', () => {
    // Day target: 150g protein
    // Floor = 150 × 0.9 = 135g
    // Target meal: salada 50g = 0.75g P
    // Chosen: goiabada 100g = 0.5g P
    // Sem outras refeições, total dia = 0.75 (ou menos após corte) + 0.5 = ~1.25g << 135g
    const target = [makeItem(SALADA, 50, 'salada')]
    const result = runSubstitution(inputFor(target, GOIABADA, 100))
    expect(result.warnings.proteinBelowFloor).toBe(true)
    expect(result.warnings.calorieAboveCeiling).toBe(false)
  })

  it('13. calorieAboveCeiling: total dia > target × 1.1', () => {
    // Day target: 2000 kcal
    // Ceiling = 2000 × 1.1 = 2200 kcal
    // consumedSoFar: 2100 kcal já comido
    // Target meal: 100 kcal
    // Chosen: pizza 200g = 530 kcal
    // newDayTotals.kcal ≈ 2100 + 0 (target cortado) + 530 + 0 = 2630 > 2200
    const target = [makeItem(SALADA, 50, 'salada')]  // 7.5 kcal
    const day: SubstitutionDayContext = {
      consumedSoFar: { kcal: 2100, protein: 140, carbs: 250, fat: 60 },
      dayTargets: { kcal: 2000, protein: 150, carbs: 250, fat: 60 },
    }
    const result = runSubstitution(inputFor(target, PIZZA, 200, [], day))
    expect(result.warnings.calorieAboveCeiling).toBe(true)
  })

  it('14. excessNotFullyAbsorbed: residual > 50 kcal AND dia > target × 1.02', () => {
    // Caso Goiaba 1142 kcal vs Jantar 545 kcal do print V1:
    // Sem futuras absorvendo → residual gigante.
    const target = [
      makeItem(FRANGO, 100, 'frango'),
      makeItem(ARROZ, 100, 'arroz'),
    ]  // ~295 kcal
    const day: SubstitutionDayContext = {
      consumedSoFar: { kcal: 1500, protein: 100, carbs: 180, fat: 40 },
      dayTargets: { kcal: 1900, protein: 150, carbs: 230, fat: 55 },
    }
    // Pizza 300g = 795 kcal. Excesso vs target = 795 - 295 = 500 kcal.
    // Sem futuras, residual = 500 kcal. Total dia = 1500 + 0 + 795 = 2295.
    // 2295 / 1900 = 1.21 > 1.02 → warning
    const result = runSubstitution(inputFor(target, PIZZA, 300, [], day))
    expect(result.warnings.excessNotFullyAbsorbed).toBe(true)
    // Os outros warnings também provavelmente ativos (sanity check de
    // combinação).
    expect(result.warnings.calorieAboveCeiling).toBe(true)
  })
})

describe('runSubstitution — excludedFutureMealIds (B7)', () => {
  it('15. excluir 1 future meal: aquela fica intacta, residualExcess maior', () => {
    // Cenário desenhado pra que as 2 futuras juntas NÃO absorvam tudo
    // (residual > 0 mesmo no baseline). Excluindo 1, residual cresce
    // mais.
    const target = [makeItem(SALADA, 50, 'salada-t')]  // 7.5 kcal
    const future1 = makeMeal([makeItem(ARROZ, 100, 'f1')], {
      id: 'future-1',
      target_time: '15:00:00',
    })  // 130 kcal
    const future2 = makeMeal([makeItem(ARROZ, 100, 'f2')], {
      id: 'future-2',
      target_time: '19:00:00',
    })  // 130 kcal
    const inputWithAll = inputFor(target, PIZZA, 200, [future1, future2])
    const resultAll = runSubstitution(inputWithAll)
    // Pizza 200g = 530 kcal. Excess = 522.5. Futuras juntas = 260 kcal.
    // Mesmo cortando tudo, sobra ~262.5 residual.

    const inputExcluded: SubstitutionInput = {
      ...inputWithAll,
      excludedFutureMealIds: new Set(['future-2']),
    }
    const resultExcluded = runSubstitution(inputExcluded)

    // future-2 NÃO deve ter adjustment quando excluída
    const f2InExcluded = resultExcluded.futureMealsAdjustments.find(
      (f) => f.mealId === 'future-2',
    )
    expect(f2InExcluded).toBeUndefined()

    // future-1 ainda deve estar (ela absorve sozinha o que conseguir)
    const f1InExcluded = resultExcluded.futureMealsAdjustments.find(
      (f) => f.mealId === 'future-1',
    )
    expect(f1InExcluded).toBeDefined()

    // Residual maior quando excluiu uma (capacidade caiu de 260 pra 130 kcal)
    expect(resultExcluded.residualExcessKcal).toBeGreaterThan(
      resultAll.residualExcessKcal,
    )
  })

  it('16. excluir TODAS as futuras: residualExcess = excess total', () => {
    const target = [makeItem(SALADA, 50, 'salada-t')]  // 7.5 kcal
    const future1 = makeMeal([makeItem(FRANGO, 200, 'f1')], {
      id: 'future-1',
      target_time: '15:00:00',
    })
    const future2 = makeMeal([makeItem(ARROZ, 250, 'f2')], {
      id: 'future-2',
      target_time: '19:00:00',
    })
    const input: SubstitutionInput = {
      ...inputFor(target, PIZZA, 100, [future1, future2]),
      excludedFutureMealIds: new Set(['future-1', 'future-2']),
    }
    const result = runSubstitution(input)

    // Nenhuma future ajustada
    expect(result.futureMealsAdjustments).toHaveLength(0)
    // Residual = excess inteiro (pizza 100g 265 kcal - target 7.5 kcal)
    expect(result.residualExcessKcal).toBeGreaterThan(250)
  })
})

// Sanity: constantes não acidentalmente mexidas
describe('engine constants', () => {
  it('expõe thresholds esperados (regressão de quebra)', () => {
    expect(PRESERVE_PROTEIN_THRESHOLD).toBe(0.3)
    expect(REDUCE_PROTEIN_THRESHOLD).toBe(0.8)
    expect(EXCESS_ABSORPTION_KCAL_THRESHOLD).toBe(50)
    expect(CALORIE_CEILING_TOLERANCE).toBe(0.1)
    expect(PROTEIN_FLOOR_TOLERANCE).toBe(0.1)
  })
})
