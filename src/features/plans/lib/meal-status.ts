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

// Acha a próxima refeição: primeira com target_time >= agora, ordenada
// por target_time ASC. Refeições sem target_time não competem (não dá
// pra saber se já passou). Se todas as com horário já passaram, retorna
// null — UI deve renderizar tudo colapsado.
//
// Convenção: refeição com horário exatamente == agora ainda é "próxima"
// (vira destacada). Só vira "passada" depois de um minuto.
export function findNextMealId(
  meals: Array<Pick<PlanTreeMealRaw, 'id' | 'target_time'>>,
  nowMinutes: number,
): string | null {
  let best: { id: string; minutes: number } | null = null
  for (const meal of meals) {
    const m = timeToMinutes(meal.target_time)
    if (m === null) continue
    if (m < nowMinutes) continue
    if (best === null || m < best.minutes) {
      best = { id: meal.id, minutes: m }
    }
  }
  return best?.id ?? null
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

  const mealMinutes = timeToMinutes(meal.target_time)
  if (mealMinutes === null) {
    // Sem horário: trata como "future" se vazia, "past-eaten" se há
    // entries. Não vira past-empty (sem horário, não dá pra dizer que
    // "passou").
    return hasEntries ? 'past-eaten' : 'future'
  }

  const isPast = nowMinutes > mealMinutes
  if (isPast) {
    return hasEntries ? 'past-eaten' : 'past-empty'
  }
  return 'future'
}
