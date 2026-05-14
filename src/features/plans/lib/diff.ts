// Diff + validação + executor do save de plano (B5).
//
// Modelo geral:
//   1. computeDiff(original, draft) → estrutura `Diff` com creates,
//      updates, deletes pra cada nível (meals/slots/options/items).
//   2. validateDraft(draft) → array de mensagens. Vazio = ok.
//   3. executeSave(supabase, planId, diff) → executa no banco em ordem
//      FK-safe: deletes bottom-up, creates top-down, updates por último.
//
// Decisões:
//   - Creates: identificados por id começando com 'draft-'.
//   - Updates: id real + qualquer campo do draft diferente do original.
//     Enviamos todos os campos no patch (não só os mudados) — mais
//     simples e o overhead é desprezível.
//   - Deletes: ids reais do original que sumiram do draft.
//   - Sem transação (Supabase JS não tem cliente). Se falhar no meio,
//     banco fica inconsistente mas o save é re-rodável (próxima tentativa
//     recalcula diff baseado no estado atual).

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

import {
  type ItemDraft,
  type MealDraft,
  type OptionDraft,
  type PlanEditorState,
  type PlanTreeItemRaw,
  type PlanTreeMealRaw,
  type PlanTreeOptionRaw,
  type PlanTreeResponse,
  type PlanTreeSlotRaw,
  type SlotDraft,
  isDraftId,
  pgTimeToHHMM,
} from './draft-types'
import { PlanValidationError } from './errors'

// ─── Tipos do diff ──────────────────────────────────────────────────

type CreateMeal = {
  tempId: string
  name: string
  target_time: string | null // 'HH:MM' ou null
  sort_order: number
}

type CreateSlot = {
  tempId: string
  // Pode ser id real (slot novo em refeição existente) OU id draft
  // (slot novo em refeição também nova). Resolve no executor via idMap.
  mealId: string
  label: string | null
  sort_order: number
}

type CreateOption = {
  tempId: string
  slotId: string
  sort_order: number
}

type CreateItem = {
  tempId: string
  optionId: string
  food_id: string
  quantity_g: number
}

type UpdateMeal = {
  id: string
  name: string
  target_time: string | null
  sort_order: number
}

type UpdateSlot = {
  id: string
  label: string | null
  sort_order: number
}

type UpdateOption = {
  id: string
  sort_order: number
}

type UpdateItem = {
  id: string
  quantity_g: number
}

export type PlanDiff = {
  planNameChanged: string | null // null = não mudou
  creates: {
    meals: CreateMeal[]
    slots: CreateSlot[]
    options: CreateOption[]
    items: CreateItem[]
  }
  updates: {
    meals: UpdateMeal[]
    slots: UpdateSlot[]
    options: UpdateOption[]
    items: UpdateItem[]
  }
  deletes: {
    items: string[]
    options: string[]
    slots: string[]
    meals: string[]
  }
}

// ─── Validação ──────────────────────────────────────────────────────

// Retorna lista de problemas. Empty = ok pra salvar.
// Ordem das checks importa pra mensagem do user fazer sentido (avisar
// nome do plano antes de slot vazio, etc).
export function validateDraft(draft: PlanEditorState): string[] {
  const issues: string[] = []

  if (draft.planName.trim() === '') {
    issues.push('Dê um nome ao plano.')
  }

  for (const meal of draft.meals) {
    const mealLabel = meal.name.trim() === '' ? '(sem nome)' : meal.name

    if (meal.name.trim() === '') {
      issues.push(`Refeição sem nome — defina antes de salvar.`)
    }

    for (const slot of meal.slots) {
      const slotLabel = slot.label ?? '(sem categoria)'

      if (slot.options.length === 0) {
        issues.push(
          `Slot "${slotLabel}" em "${mealLabel}" precisa de pelo menos 1 opção.`,
        )
        continue
      }

      slot.options.forEach((option, idx) => {
        if (option.items.length === 0) {
          issues.push(
            `Opção ${idx + 1} do slot "${slotLabel}" em "${mealLabel}" precisa de pelo menos 1 alimento.`,
          )
        }
      })
    }
  }

  return issues
}

// ─── Diff ────────────────────────────────────────────────────────────

export function computeDiff(
  original: PlanTreeResponse,
  draft: PlanEditorState,
): PlanDiff {
  // Indexação pra lookups O(1) em todos os níveis do original.
  const origMealById = new Map<string, PlanTreeMealRaw>()
  const origSlotById = new Map<string, PlanTreeSlotRaw>()
  const origOptionById = new Map<string, PlanTreeOptionRaw>()
  const origItemById = new Map<string, PlanTreeItemRaw>()

  for (const m of original.meals) {
    origMealById.set(m.id, m)
    for (const s of m.slots) {
      origSlotById.set(s.id, s)
      for (const o of s.options) {
        origOptionById.set(o.id, o)
        for (const i of o.items) {
          origItemById.set(i.id, i)
        }
      }
    }
  }

  // Sets pra rastrear quais ids reais aparecem no draft.
  const draftMealIds = new Set<string>()
  const draftSlotIds = new Set<string>()
  const draftOptionIds = new Set<string>()
  const draftItemIds = new Set<string>()

  const creates: PlanDiff['creates'] = {
    meals: [],
    slots: [],
    options: [],
    items: [],
  }
  const updates: PlanDiff['updates'] = {
    meals: [],
    slots: [],
    options: [],
    items: [],
  }

  for (const meal of draft.meals) {
    processMeal(meal, origMealById, draftMealIds, creates, updates)
    for (const slot of meal.slots) {
      processSlot(slot, meal.id, origSlotById, draftSlotIds, creates, updates)
      for (const option of slot.options) {
        processOption(
          option,
          slot.id,
          origOptionById,
          draftOptionIds,
          creates,
          updates,
        )
        for (const item of option.items) {
          processItem(
            item,
            option.id,
            origItemById,
            draftItemIds,
            creates,
            updates,
          )
        }
      }
    }
  }

  // Deletes = ids reais do original que NÃO apareceram no draft.
  const deletes: PlanDiff['deletes'] = {
    items: Array.from(origItemById.keys()).filter((id) => !draftItemIds.has(id)),
    options: Array.from(origOptionById.keys()).filter(
      (id) => !draftOptionIds.has(id),
    ),
    slots: Array.from(origSlotById.keys()).filter((id) => !draftSlotIds.has(id)),
    meals: Array.from(origMealById.keys()).filter((id) => !draftMealIds.has(id)),
  }

  const planNameChanged =
    original.plan.name !== draft.planName ? draft.planName : null

  return {
    planNameChanged,
    creates,
    updates,
    deletes,
  }
}

function processMeal(
  meal: MealDraft,
  origById: Map<string, PlanTreeMealRaw>,
  draftIds: Set<string>,
  creates: PlanDiff['creates'],
  updates: PlanDiff['updates'],
) {
  if (isDraftId(meal.id)) {
    creates.meals.push({
      tempId: meal.id,
      name: meal.name,
      target_time: meal.target_time,
      sort_order: meal.sort_order,
    })
    return
  }
  draftIds.add(meal.id)
  const orig = origById.get(meal.id)
  if (!orig) return
  const origTimeShort = pgTimeToHHMM(orig.target_time)
  if (
    orig.name !== meal.name ||
    origTimeShort !== meal.target_time ||
    orig.sort_order !== meal.sort_order
  ) {
    updates.meals.push({
      id: meal.id,
      name: meal.name,
      target_time: meal.target_time,
      sort_order: meal.sort_order,
    })
  }
}

function processSlot(
  slot: SlotDraft,
  mealId: string,
  origById: Map<string, PlanTreeSlotRaw>,
  draftIds: Set<string>,
  creates: PlanDiff['creates'],
  updates: PlanDiff['updates'],
) {
  if (isDraftId(slot.id)) {
    creates.slots.push({
      tempId: slot.id,
      mealId,
      label: slot.label,
      sort_order: slot.sort_order,
    })
    return
  }
  draftIds.add(slot.id)
  const orig = origById.get(slot.id)
  if (!orig) return
  if (orig.label !== slot.label || orig.sort_order !== slot.sort_order) {
    updates.slots.push({
      id: slot.id,
      label: slot.label,
      sort_order: slot.sort_order,
    })
  }
}

function processOption(
  option: OptionDraft,
  slotId: string,
  origById: Map<string, PlanTreeOptionRaw>,
  draftIds: Set<string>,
  creates: PlanDiff['creates'],
  updates: PlanDiff['updates'],
) {
  if (isDraftId(option.id)) {
    creates.options.push({
      tempId: option.id,
      slotId,
      sort_order: option.sort_order,
    })
    return
  }
  draftIds.add(option.id)
  const orig = origById.get(option.id)
  if (!orig) return
  if (orig.sort_order !== option.sort_order) {
    updates.options.push({
      id: option.id,
      sort_order: option.sort_order,
    })
  }
}

function processItem(
  item: ItemDraft,
  optionId: string,
  origById: Map<string, PlanTreeItemRaw>,
  draftIds: Set<string>,
  creates: PlanDiff['creates'],
  updates: PlanDiff['updates'],
) {
  if (isDraftId(item.id)) {
    creates.items.push({
      tempId: item.id,
      optionId,
      food_id: item.food_id,
      quantity_g: item.quantity_g,
    })
    return
  }
  draftIds.add(item.id)
  const orig = origById.get(item.id)
  if (!orig) return
  if (Number(orig.quantity_g) !== item.quantity_g) {
    updates.items.push({
      id: item.id,
      quantity_g: item.quantity_g,
    })
  }
}

// ─── Executor ───────────────────────────────────────────────────────

// Helper pra serializar 'HH:MM' do draft pra 'HH:MM:00' do postgres
// `time`. Postgres aceita 'HH:MM' direto, mas mandar 'HH:MM:00'
// padroniza com o que o RPC `get_plan_tree` devolve no read e evita
// surpresa no diff (compararíamos 'HH:MM:00' com 'HH:MM' depois).
function hhmmToPgTime(t: string | null): string | null {
  if (!t) return null
  return /^\d{2}:\d{2}$/.test(t) ? `${t}:00` : t
}

// Executa o save no banco em ordem FK-safe.
//
// Ordem:
//   1. UPDATE plan.name se mudou
//   2. DELETEs bottom-up (items → options → slots → meals)
//   3. CREATEs top-down (meals → slots → options → items), mapeando
//      tempId → realId conforme inserimos
//   4. UPDATEs (qualquer ordem)
//
// Por que DELETE antes de CREATE: caso o user tenha removido um slot
// e recriado um novo no mesmo lugar, fazer DELETE primeiro evita
// problemas de UNIQUE/constraint que poderia existir (não temos hoje,
// mas é mais defensivo).
export async function executeSave(
  supabase: SupabaseClient<Database>,
  planId: string,
  diff: PlanDiff,
): Promise<void> {
  // 1. Plan name
  if (diff.planNameChanged !== null) {
    const { error } = await supabase
      .from('meal_plans')
      .update({ name: diff.planNameChanged })
      .eq('id', planId)
    if (error) throw error
  }

  // 2. DELETEs bottom-up
  if (diff.deletes.items.length > 0) {
    const { error } = await supabase
      .from('option_items')
      .delete()
      .in('id', diff.deletes.items)
    if (error) throw error
  }
  if (diff.deletes.options.length > 0) {
    const { error } = await supabase
      .from('slot_options')
      .delete()
      .in('id', diff.deletes.options)
    if (error) throw error
  }
  if (diff.deletes.slots.length > 0) {
    const { error } = await supabase
      .from('plan_slots')
      .delete()
      .in('id', diff.deletes.slots)
    if (error) throw error
  }
  if (diff.deletes.meals.length > 0) {
    const { error } = await supabase
      .from('plan_meals')
      .delete()
      .in('id', diff.deletes.meals)
    if (error) throw error
  }

  // 3. CREATEs top-down + idMap
  const idMap = new Map<string, string>()
  const resolveId = (id: string) => idMap.get(id) ?? id

  for (const meal of diff.creates.meals) {
    const { data, error } = await supabase
      .from('plan_meals')
      .insert({
        plan_id: planId,
        name: meal.name,
        target_time: hhmmToPgTime(meal.target_time),
        sort_order: meal.sort_order,
      })
      .select('id')
      .single()
    if (error) throw error
    if (!data) throw new Error('plan_meals INSERT sem retorno')
    idMap.set(meal.tempId, data.id)
  }

  for (const slot of diff.creates.slots) {
    const { data, error } = await supabase
      .from('plan_slots')
      .insert({
        meal_id: resolveId(slot.mealId),
        label: slot.label,
        sort_order: slot.sort_order,
      })
      .select('id')
      .single()
    if (error) throw error
    if (!data) throw new Error('plan_slots INSERT sem retorno')
    idMap.set(slot.tempId, data.id)
  }

  for (const option of diff.creates.options) {
    const { data, error } = await supabase
      .from('slot_options')
      .insert({
        slot_id: resolveId(option.slotId),
        sort_order: option.sort_order,
      })
      .select('id')
      .single()
    if (error) throw error
    if (!data) throw new Error('slot_options INSERT sem retorno')
    idMap.set(option.tempId, data.id)
  }

  for (const item of diff.creates.items) {
    const { data, error } = await supabase
      .from('option_items')
      .insert({
        option_id: resolveId(item.optionId),
        food_id: item.food_id,
        quantity_g: item.quantity_g,
      })
      .select('id')
      .single()
    if (error) throw error
    if (!data) throw new Error('option_items INSERT sem retorno')
    idMap.set(item.tempId, data.id)
  }

  // 4. UPDATEs (ids são todos reais aqui)
  for (const meal of diff.updates.meals) {
    const { error } = await supabase
      .from('plan_meals')
      .update({
        name: meal.name,
        target_time: hhmmToPgTime(meal.target_time),
        sort_order: meal.sort_order,
      })
      .eq('id', meal.id)
    if (error) throw error
  }
  for (const slot of diff.updates.slots) {
    const { error } = await supabase
      .from('plan_slots')
      .update({
        label: slot.label,
        sort_order: slot.sort_order,
      })
      .eq('id', slot.id)
    if (error) throw error
  }
  for (const option of diff.updates.options) {
    const { error } = await supabase
      .from('slot_options')
      .update({
        sort_order: option.sort_order,
      })
      .eq('id', option.id)
    if (error) throw error
  }
  for (const item of diff.updates.items) {
    const { error } = await supabase
      .from('option_items')
      .update({
        quantity_g: item.quantity_g,
      })
      .eq('id', item.id)
    if (error) throw error
  }
}

// Helper combinado pra caller: valida, joga PlanValidationError se ruim,
// computa diff, retorna.
export function validateAndComputeDiff(
  original: PlanTreeResponse,
  draft: PlanEditorState,
): PlanDiff {
  const issues = validateDraft(draft)
  if (issues.length > 0) throw new PlanValidationError(issues)
  return computeDiff(original, draft)
}
