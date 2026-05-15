import type { PlanTreeMealRaw } from './draft-types'

// Estado visual de uma refeição em /plano (Fase 6 B1).
//
//   'next'        — é a próxima refeição (destaque, card grande).
//   'past-eaten'  — horário passou e há entries no diário (✓ verde).
//   'past-empty'  — horário passou e não há entries (○ cinza).
//   'future'      — horário ainda não chegou OU sem target_time, e
//                   não é a próxima (○ cinza, mesmo visual que past-empty).
//
// Sem persistência: estado é derivado a cada render de (hora atual BR,
// entries existentes no daily_log de hoje, target_time da refeição).
export type MealStatus = 'next' | 'past-eaten' | 'past-empty' | 'future'

// Converte 'HH:MM:SS' (postgres time) ou 'HH:MM' pra minutos desde
// meia-noite. Retorna null se input for null ou formato inválido.
export function timeToMinutes(time: string | null): number | null {
  if (!time) return null
  const m = /^(\d{2}):(\d{2})/.exec(time)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

// Acha a refeição a destacar como "próxima" no /plano.
//
// Regra (revisada no setup do B1, 2026-05-14):
// SEMPRE há uma refeição destacada quando há pelo menos UMA não-comida.
// Só quando TODAS estão ✓ (têm entries) é que não há destaque.
//
// Priorização entre as não-comidas:
//   1. Primeira NÃO-COMIDA com target_time >= now (caso normal — usuário
//      ainda está dentro da janela esperada).
//   2. Se nenhuma satisfaz #1 (todas as não-comidas já estão atrasadas):
//      primeira NÃO-COMIDA em ordem cronológica. Ex: passou da hora do
//      café e do almoço, ambos sem entries → café fica como destaque
//      (mais antigo não-resolvido).
//   3. Se todas as refeições estão comidas: retorna null.
//
// Refeições sem target_time competem pelo destaque na ordem de
// sort_order, mas perdem pra qualquer não-comida com target_time válido
// no critério #1.
export function findNextMealId(
  meals: Array<{
    id: string
    target_time: string | null
    sort_order: number
    hasEntries: boolean
  }>,
  nowMinutes: number,
): string | null {
  const unfinished = meals.filter((m) => !m.hasEntries)
  if (unfinished.length === 0) return null

  // Ordena por target_time ASC; null no fim; desempate por sort_order.
  const sorted = [...unfinished].sort((a, b) => {
    const am = timeToMinutes(a.target_time)
    const bm = timeToMinutes(b.target_time)
    if (am === null && bm === null) return a.sort_order - b.sort_order
    if (am === null) return 1
    if (bm === null) return -1
    if (am === bm) return a.sort_order - b.sort_order
    return am - bm
  })

  // Critério #1: primeira não-comida com target_time >= now.
  const upcoming = sorted.find((m) => {
    const mm = timeToMinutes(m.target_time)
    return mm !== null && mm >= nowMinutes
  })
  if (upcoming) return upcoming.id

  // Critério #2: primeira não-comida (atrasada mais antiga, ou sem
  // horário em ordem de sort_order).
  return sorted[0].id
}

interface GetMealStatusInput {
  meal: Pick<PlanTreeMealRaw, 'id' | 'target_time'>
  isNext: boolean
  hasEntries: boolean
  nowMinutes: number
}

export function getMealStatus({
  meal,
  isNext,
  hasEntries,
  nowMinutes,
}: GetMealStatusInput): MealStatus {
  if (isNext) return 'next'
  if (hasEntries) return 'past-eaten'

  // Sem entries e não é a destacada — distingue past-empty (horário já
  // passou) vs future (ainda vai chegar). Refeição sem target_time cai
  // em 'future' (não há critério temporal pra dizer que passou).
  const mealMinutes = timeToMinutes(meal.target_time)
  if (mealMinutes === null) return 'future'
  return nowMinutes > mealMinutes ? 'past-empty' : 'future'
}
