import type {
  ItemDraftFood,
  PlanTreeOptionRaw,
  PlanTreeSlotRaw,
} from './draft-types'

// Helpers puros pra calcular macros de option/slot/refeição do plano.
// Extraídos do PlanMealReadonly (Fase 5) na Fase 6 B1 pra reuso entre
// ProximaRefeicaoCard e RefeicaoCollapsedCard sem duplicação.

export interface OptionMacros {
  kcal: number
  p: number
  c: number
  g: number
}

// Macros de um food numa qty arbitrária. Útil quando há override de qty
// (ex: adjustment do dia define qty diferente da cadastrada na option) —
// Fase 6 B2 / B5.
export function foodMacrosAtQty(
  food: ItemDraftFood,
  qtyG: number,
): OptionMacros {
  const factor = qtyG / 100
  return {
    kcal: food.kcal_per_100g * factor,
    p: food.protein_per_100g * factor,
    c: food.carb_per_100g * factor,
    g: food.fat_per_100g * factor,
  }
}

// Alternativa principal de um slot = option com menor sort_order.
// Retorna undefined se o slot não tem options (estado inválido mas
// defensivo).
export function primaryOption(
  slot: PlanTreeSlotRaw,
): PlanTreeOptionRaw | undefined {
  if (slot.options.length === 0) return undefined
  return [...slot.options].sort((a, b) => a.sort_order - b.sort_order)[0]
}

// Macros de uma option = soma dos items (defensivo com 2+ items, embora
// a UI da Fase 5 force 1 item por option). Quando a UI nova reescrever
// o plano, items extras desaparecem no save.
export function optionMacros(option: PlanTreeOptionRaw): OptionMacros {
  return option.items.reduce<OptionMacros>(
    (acc, item) => {
      const factor = Number(item.quantity_g) / 100
      return {
        kcal: acc.kcal + item.food.kcal_per_100g * factor,
        p: acc.p + item.food.protein_per_100g * factor,
        c: acc.c + item.food.carb_per_100g * factor,
        g: acc.g + item.food.fat_per_100g * factor,
      }
    },
    { kcal: 0, p: 0, c: 0, g: 0 },
  )
}

// Macros totais de uma refeição = soma da alternativa principal de cada
// slot. Evita ambiguidade de "qual alternativa pesar" — pega sempre a
// principal. Slots sem alternativas contribuem zero.
export function mealTotals(slots: PlanTreeSlotRaw[]): OptionMacros {
  return slots.reduce<OptionMacros>(
    (acc, slot) => {
      const primary = primaryOption(slot)
      if (!primary) return acc
      const m = optionMacros(primary)
      return {
        kcal: acc.kcal + m.kcal,
        p: acc.p + m.p,
        c: acc.c + m.c,
        g: acc.g + m.g,
      }
    },
    { kcal: 0, p: 0, c: 0, g: 0 },
  )
}
