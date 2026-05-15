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
// Regra (revisada no B1 da Fase 6, 2026-05-14):
// SEMPRE há uma refeição destacada quando há pelo menos UMA não-comida.
// Só quando TODAS estão ✓ (têm entries) é que não há destaque.
//
// Critério: dentre as NÃO-COMIDAS, escolhe a com MENOR DISTÂNCIA
// ABSOLUTA ao horário atual. Não importa se já passou ou ainda vai
// chegar — a mais próxima em valor absoluto vence.
//
// Exemplos (com refeições 07:00 / 12:00 / 19:00, todas não-comidas):
//   - 22:02 BR → distâncias 902 / 602 / 182min → destaca 19:00
//   - 14:00 BR → distâncias 420 / 120 / 300min → destaca 12:00
//   - 06:30 BR → distâncias 30 / 330 / 750min → destaca 07:00
//
// Desempate (distâncias iguais): target_time mais cedo. Ex: às 13:00
// com refeições 10:00 e 16:00 (ambas 3h de distância) → destaca 10:00.
//
// Refeições SEM target_time não competem pelo destaque; só viram
// destacadas se nenhuma não-comida tiver horário (fallback por
// sort_order).
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

  let best: { id: string; distance: number; minutes: number } | null = null
  for (const m of unfinished) {
    const mm = timeToMinutes(m.target_time)
    if (mm === null) continue
    const distance = Math.abs(mm - nowMinutes)
    if (
      best === null ||
      distance < best.distance ||
      (distance === best.distance && mm < best.minutes)
    ) {
      best = { id: m.id, distance, minutes: mm }
    }
  }
  if (best !== null) return best.id

  // Fallback: nenhuma não-comida tem target_time. Pega a primeira em
  // ordem de sort_order.
  const sortedByOrder = [...unfinished].sort(
    (a, b) => a.sort_order - b.sort_order,
  )
  return sortedByOrder[0].id
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
