// Tipos do EDITOR de plano (B3-B5).
//
// Por que tipos separados de types.ts:
//   - `types.ts` tem a forma "limpa" do banco (MealPlan etc.), usada
//     em listas/views read-only.
//   - Aqui temos a forma "rascunho" — id pode ser uuid real (item já no
//     banco) ou "draft-uuid" (item novo criado no cliente). A diferenciação
//     é a base do diff FK-safe que o B5 vai executar.
//
// Convenção de IDs:
//   - Item carregado da RPC `get_plan_tree`: id é o uuid real.
//   - Item criado pelo user no editor: id começa com `draft-` (helper
//     `makeDraftId()` abaixo). No save, o backend gera o uuid real e
//     atualizamos o draft com o id retornado.
//
// `target_time` no editor é guardado como 'HH:MM' (formato amigável do
// <input type="time">). A RPC devolve 'HH:MM:SS' (postgres time). A
// conversão `'HH:MM:SS' ↔ 'HH:MM'` acontece no hook (parse no fetch,
// serialize no save do B5).

export type DraftId = string

const DRAFT_PREFIX = 'draft-'

export function makeDraftId(): DraftId {
  return `${DRAFT_PREFIX}${crypto.randomUUID()}`
}

export function isDraftId(id: DraftId): boolean {
  return id.startsWith(DRAFT_PREFIX)
}

// ─── Drafts (estado mutável do editor) ──────────────────────────────

export type ItemDraft = {
  id: DraftId
  food_id: string
  quantity_g: number
  // Info denormalizada pra exibir nome + macros sem nova query.
  // Vem populada quando carregamos do banco (RPC já inclui o food).
  // Quando user adiciona item novo no B4, vem do picker que tem essa
  // info no resultado da busca.
  food: ItemDraftFood | null
}

export type ItemDraftFood = {
  id: string
  name: string
  brand: string | null
  source: string
  default_serving_g: number
  serving_label: string | null
  kcal_per_100g: number
  protein_per_100g: number
  carb_per_100g: number
  fat_per_100g: number
  recalc_whole_units_only: boolean
}

export type OptionDraft = {
  id: DraftId
  sort_order: number
  items: ItemDraft[]
}

export type SlotDraft = {
  id: DraftId
  label: string | null
  sort_order: number
  options: OptionDraft[]
}

export type MealDraft = {
  id: DraftId
  name: string
  target_time: string | null  // 'HH:MM' ou null
  sort_order: number
  slots: SlotDraft[]
}

// Estado completo do editor. `originalLoadedAt` é usado pra detectar
// se houve modificação após o load (não usado no B3, fica preparado
// pro B5 ou pra um warning de "sair sem salvar").
export type PlanEditorState = {
  planId: string
  planName: string
  meals: MealDraft[]
}

// ─── RPC response (get_plan_tree) ───────────────────────────────────

export type PlanTreeResponse = {
  plan: PlanTreePlanRaw
  meals: PlanTreeMealRaw[]
}

export type PlanTreePlanRaw = {
  id: string
  user_id: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type PlanTreeMealRaw = {
  id: string
  name: string
  target_time: string | null  // 'HH:MM:SS' do postgres
  sort_order: number
  slots: PlanTreeSlotRaw[]
}

export type PlanTreeSlotRaw = {
  id: string
  label: string | null
  sort_order: number
  options: PlanTreeOptionRaw[]
}

export type PlanTreeOptionRaw = {
  id: string
  sort_order: number
  items: PlanTreeItemRaw[]
}

export type PlanTreeItemRaw = {
  id: string
  food_id: string
  quantity_g: number
  food: ItemDraftFood
}

// ─── Conversores RPC → Draft ────────────────────────────────────────

// Postgres `time` vem como 'HH:MM:SS'. Para o <input type="time">,
// passamos 'HH:MM' (24h). Inverso (B5 save) re-adiciona ':00' se
// necessário.
export function pgTimeToHHMM(t: string | null): string | null {
  if (!t) return null
  // 'HH:MM:SS' → 'HH:MM'
  const m = /^(\d{2}):(\d{2})/.exec(t)
  return m ? `${m[1]}:${m[2]}` : null
}

export function planTreeToEditorState(
  planId: string,
  tree: PlanTreeResponse,
): PlanEditorState {
  return {
    planId,
    planName: tree.plan.name,
    meals: tree.meals.map(rawMealToDraft),
  }
}

function rawMealToDraft(meal: PlanTreeMealRaw): MealDraft {
  return {
    id: meal.id,
    name: meal.name,
    target_time: pgTimeToHHMM(meal.target_time),
    sort_order: meal.sort_order,
    slots: meal.slots.map((slot) => ({
      id: slot.id,
      label: slot.label,
      sort_order: slot.sort_order,
      options: slot.options.map((opt) => ({
        id: opt.id,
        sort_order: opt.sort_order,
        items: opt.items.map((item) => ({
          id: item.id,
          food_id: item.food_id,
          quantity_g: Number(item.quantity_g),
          food: item.food,
        })),
      })),
    })),
  }
}

// ─── Sort helpers ────────────────────────────────────────────────────

// Comparador estável pra refeições: ordena por target_time crescente
// (null vai pro fim, como "refeições sem horário"). Desempate por
// sort_order (preserva a ordem de adição).
//
// Decisão Ricardo (Fase 5 setup): auto-ordenar por horário em vez de
// sort_order manual. Sort_order continua sendo persistido no banco —
// só não é mais editável manualmente.
export function compareMealsByTime(a: MealDraft, b: MealDraft): number {
  if (a.target_time === null && b.target_time === null) {
    return a.sort_order - b.sort_order
  }
  if (a.target_time === null) return 1
  if (b.target_time === null) return -1
  if (a.target_time === b.target_time) return a.sort_order - b.sort_order
  return a.target_time.localeCompare(b.target_time)
}
