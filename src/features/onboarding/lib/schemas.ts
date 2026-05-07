import { z } from 'zod'
import { calculateAge } from '@/lib/macros'

// === Enums ===
// CRITICAL: valores devem ficar em sincronia com @/lib/macros.ts
// (constantes ACTIVITY_LEVELS / GOALS), com os enums do Postgres
// (activity_level, goal) e com o CHECK de profiles.sex.
export const sexSchema = z.enum(['M', 'F'], {
  message: 'Selecione uma opção',
})

export const activityLevelSchema = z.enum(
  ['sedentary', 'light', 'moderate', 'active', 'very_active'],
  { message: 'Selecione um nível de atividade' },
)

export const goalSchema = z.enum(['cut', 'maintain', 'bulk'], {
  message: 'Selecione um objetivo',
})

// === Schemas por step ===
//
// Convenção: nomes de campos em camelCase no TS, mapeados pra snake_case
// do banco no momento do save (display_name, birth_date, height_cm, etc).

export const basicInfoSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Informe seu nome')
    .max(60, 'Nome muito longo (máx. 60 caracteres)'),
})

export const bodySchema = z.object({
  sex: sexSchema,
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Selecione uma data válida')
    .refine((val) => !Number.isNaN(new Date(val).getTime()), {
      message: 'Data inválida',
    })
    .refine(
      (val) => {
        const age = calculateAge(new Date(val))
        return age >= 13 && age <= 120
      },
      { message: 'Idade deve estar entre 13 e 120 anos' },
    ),
  heightCm: z
    .number({ message: 'Informe sua altura' })
    .positive('Altura deve ser positiva')
    .min(100, 'Altura mínima: 100 cm')
    .max(250, 'Altura máxima: 250 cm'),
  weightKg: z
    .number({ message: 'Informe seu peso' })
    .positive('Peso deve ser positivo')
    .min(30, 'Peso mínimo: 30 kg')
    .max(300, 'Peso máximo: 300 kg'),
})

export const activitySchema = z.object({
  activityLevel: activityLevelSchema,
})

export const goalChoiceSchema = z.object({
  goal: goalSchema,
})

// === Schema agregado ===
//
// Construído por composição (.shape spread). Mudar um campo num step
// schema acima propaga automaticamente pra cá.

export const onboardingFullSchema = z.object({
  ...basicInfoSchema.shape,
  ...bodySchema.shape,
  ...activitySchema.shape,
  ...goalChoiceSchema.shape,
})

// === Tipos inferidos ===

export type BasicInfoData = z.infer<typeof basicInfoSchema>
export type BodyData = z.infer<typeof bodySchema>
export type ActivityData = z.infer<typeof activitySchema>
export type GoalChoiceData = z.infer<typeof goalChoiceSchema>
export type OnboardingFullData = z.infer<typeof onboardingFullSchema>
