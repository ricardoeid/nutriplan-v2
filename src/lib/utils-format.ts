import {
  ACTIVITY_LEVELS,
  GOALS,
  type ActivityLevel,
  type Goal,
  type Sex,
} from './macros'

export function formatDateBR(isoDate: string): string {
  // isoDate vem como YYYY-MM-DD do <input type="date">. Construir Date
  // com 'T00:00:00' garante interpretação como local time, evitando
  // off-by-one em fuso negativo (Brasília é UTC-3).
  const date = new Date(`${isoDate}T00:00:00`)
  return date.toLocaleDateString('pt-BR')
}

export function formatSex(sex: Sex): string {
  return sex === 'M' ? 'Masculino' : 'Feminino'
}

export function formatActivityLevel(value: ActivityLevel): string {
  return ACTIVITY_LEVELS.find((a) => a.value === value)?.label ?? value
}

export function formatGoal(value: Goal): string {
  return GOALS.find((g) => g.value === value)?.label ?? value
}
