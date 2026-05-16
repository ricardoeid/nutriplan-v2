import type {
  ItemDraftFood,
  MealDraft,
  PlanTreeOptionRaw,
  PlanTreeSlotRaw,
  SlotDraft,
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

// ─── Overlay (active option / active totals) ────────────────────────
//
// Helpers que consideram plan_day_adjustments — extraídos pra reuso
// entre /plano cards (ProximaRefeicaoCard, RefeicaoCollapsedCard,
// MealCommitSheet) e Home (MealCard B4 — Esperado vs Comido).
//
// Tipo `ActiveAdjustment` é genérico (subset estrutural). Callers
// passam Map<string, PlanDayAdjustment> que satisfaz structurally —
// não há ciclo de import com types/database.

export interface ActiveAdjustment {
  plan_option_id: string
  adjusted_quantity_g: number | string
}

// Retorna a opção "ativa" do slot considerando o adjustment do dia.
// Sem adjustment → primária (sort_order=0).
// Com adjustment → option apontada; fallback defensivo na primária se
// não achar (option deletada do plano).
export function activeOptionInSlot(
  slot: PlanTreeSlotRaw,
  adjustment: ActiveAdjustment | undefined,
): PlanTreeOptionRaw | undefined {
  const sorted = [...slot.options].sort((a, b) => a.sort_order - b.sort_order)
  if (sorted.length === 0) return undefined
  if (!adjustment) return sorted[0]
  return sorted.find((o) => o.id === adjustment.plan_option_id) ?? sorted[0]
}

// Totais de uma refeição usando opções ATIVAS (overlay) + qty do
// adjustment quando há. Slot sem option ou option sem item contribui
// zero — defensivo com schemas/dados parciais.
//
// USA QTY AJUSTADA — reflete o estado real do dia incluindo
// propagações/substituições. Use em sheets de review, no /plano card
// destacado (preview do que vai consumir). NÃO use em "Esperado plano"
// na Home — pra isso use mealTotalsExpected.
export function activeMealTotals(
  slots: PlanTreeSlotRaw[],
  adjustmentsBySlotId: Map<string, ActiveAdjustment>,
): OptionMacros {
  return slots.reduce<OptionMacros>(
    (acc, slot) => {
      const adj = adjustmentsBySlotId.get(slot.id)
      const active = activeOptionInSlot(slot, adj)
      if (!active) return acc
      const item = active.items[0]
      if (!item) return acc
      const qty = adj ? Number(adj.adjusted_quantity_g) : Number(item.quantity_g)
      const m = foodMacrosAtQty(item.food, qty)
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

// ─── Versões pra MealDraft (editor de plano) ────────────────────────
//
// Editor usa draft types (SlotDraft + OptionDraft + ItemDraft) onde
// item.food pode ser null (edge case raro). Sempre soma a PRINCIPAL
// (sort_order=0) de cada slot — alternativas (sort > 0) são "ou", não
// contam pro total da refeição.

export function mealTotalsDraft(slots: SlotDraft[]): OptionMacros {
  return slots.reduce<OptionMacros>(
    (acc, slot) => {
      const sortedOpts = [...slot.options].sort(
        (a, b) => a.sort_order - b.sort_order,
      )
      const primary = sortedOpts[0]
      if (!primary) return acc
      const item = primary.items[0]
      if (!item || !item.food) return acc
      const factor = item.quantity_g / 100
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

// Total do plano inteiro: soma das `mealTotalsDraft` de cada refeição.
// Usado no header do plan-edit pra dar visão de "≈ 2400 kcal" enquanto
// user monta o plano.
export function planTotalsDraft(meals: MealDraft[]): OptionMacros {
  return meals.reduce<OptionMacros>(
    (acc, meal) => {
      const m = mealTotalsDraft(meal.slots)
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

// Totais ESPERADOS de uma refeição: usa opção ATIVA (overlay com
// adjustment B2 — alternativas SÃO o plano) mas QTY CADASTRADA da
// option (ignora adjusted_quantity_g do B6 — propagação/substituição
// não muda o que era "esperado" pelo nutricionista).
//
// Use no MealCard da Home pra "Esperado plano: X kcal · YP · ZC · WG".
// Match V1: print mostra "Esperado plano: 646 kcal" mantido mesmo
// após substituição que ajustou items pra menos.
export function mealTotalsExpected(
  slots: PlanTreeSlotRaw[],
  adjustmentsBySlotId: Map<string, ActiveAdjustment>,
): OptionMacros {
  return slots.reduce<OptionMacros>(
    (acc, slot) => {
      const adj = adjustmentsBySlotId.get(slot.id)
      const active = activeOptionInSlot(slot, adj)
      if (!active) return acc
      const item = active.items[0]
      if (!item) return acc
      // Sempre qty cadastrada — ignora adjusted_quantity_g
      const qty = Number(item.quantity_g)
      const m = foodMacrosAtQty(item.food, qty)
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
