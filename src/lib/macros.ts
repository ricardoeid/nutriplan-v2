// Cálculo de BMR (Mifflin-St Jeor), TDEE e targets de macros.
// Valores dos enums (ACTIVITY_LEVELS.value, GOALS.value, Sex) batem
// exatamente com os enums do Postgres (activity_level, goal) e CHECK
// constraint de profiles.sex. Manter sincronizado se schema mudar.

export type Sex = 'M' | 'F'

export const ACTIVITY_LEVELS = [
  {
    value: 'sedentary',
    label: 'Sedentário',
    description: 'Pouco ou nenhum exercício',
    multiplier: 1.2,
  },
  {
    value: 'light',
    label: 'Levemente ativo',
    description: 'Exercício leve 1-3 dias por semana',
    multiplier: 1.375,
  },
  {
    value: 'moderate',
    label: 'Moderadamente ativo',
    description: 'Exercício moderado 3-5 dias por semana',
    multiplier: 1.55,
  },
  {
    value: 'active',
    label: 'Muito ativo',
    description: 'Exercício intenso 6-7 dias por semana',
    multiplier: 1.725,
  },
  {
    value: 'very_active',
    label: 'Extremamente ativo',
    description: 'Exercício intenso 2x ao dia ou trabalho físico pesado',
    multiplier: 1.9,
  },
] as const

export type ActivityLevel = typeof ACTIVITY_LEVELS[number]['value']

export const GOALS = [
  {
    value: 'cut',
    label: 'Cortar',
    description: 'Perder gordura',
    multiplier: 0.8,
  },
  {
    value: 'maintain',
    label: 'Manter',
    description: 'Manter peso atual',
    multiplier: 1.0,
  },
  {
    value: 'bulk',
    label: 'Ganhar',
    description: 'Ganhar massa',
    multiplier: 1.1,
  },
] as const

export type Goal = typeof GOALS[number]['value']

export interface MacroTargets {
  calorieTarget: number
  proteinTarget: number
  carbTarget: number
  fatTarget: number
}

// Idade em anos a partir de data de nascimento. Usa data local — pra
// targets de macro a precisão de fuso horário não importa (idade só
// muda 1x/ano). `today` injetável pra testes.
export function calculateAge(birthDate: Date, today: Date = new Date()): number {
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

// BMR Mifflin-St Jeor:
//   Homem:  10·kg + 6.25·cm - 5·idade + 5
//   Mulher: 10·kg + 6.25·cm - 5·idade - 161
export function calculateBMR(params: {
  sex: Sex
  ageYears: number
  heightCm: number
  weightKg: number
}): number {
  const { sex, ageYears, heightCm, weightKg } = params
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears
  return sex === 'M' ? base + 5 : base - 161
}

export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  const level = ACTIVITY_LEVELS.find((a) => a.value === activityLevel)
  if (!level) {
    throw new Error(`Invalid activity level: ${activityLevel}`)
  }
  return bmr * level.multiplier
}

// Targets de macro:
//   kcal     = TDEE · ajuste de goal
//   proteína = 2.0 g/kg (peso corporal)
//   gordura  = 25% das kcal ÷ 9 kcal/g
//   carbo    = kcal restantes ÷ 4 kcal/g
//
// Math.max(0, carb) protege casos extremos (peso muito alto, kcal
// muito baixa) onde proteína + gordura já passariam da meta calórica.
// Não esperado em uso normal, mas matematicamente possível.
export function calculateMacroTargets(params: {
  tdee: number
  goal: Goal
  weightKg: number
}): MacroTargets {
  const { tdee, goal, weightKg } = params
  const goalConfig = GOALS.find((g) => g.value === goal)
  if (!goalConfig) {
    throw new Error(`Invalid goal: ${goal}`)
  }

  const calorieTarget = tdee * goalConfig.multiplier
  const proteinTarget = weightKg * 2.0
  const fatTarget = (calorieTarget * 0.25) / 9
  const carbTarget = (calorieTarget - proteinTarget * 4 - fatTarget * 9) / 4

  return {
    calorieTarget: Math.round(calorieTarget),
    proteinTarget: Math.round(proteinTarget),
    carbTarget: Math.round(Math.max(0, carbTarget)),
    fatTarget: Math.round(fatTarget),
  }
}
