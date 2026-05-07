import { type UseFormReturn } from 'react-hook-form'

import {
  calculateAge,
  calculateBMR,
  calculateMacroTargets,
  calculateTDEE,
} from '@/lib/macros'
import { type OnboardingFullData } from '../lib/schemas'

interface Props {
  form: UseFormReturn<OnboardingFullData>
}

export function StepMacrosReview({ form }: Props) {
  // Em uso normal, todos os campos já passaram validação dos steps
  // anteriores. Mas defensiva: se algo vier vazio, mostra '--'.
  const sex = form.watch('sex')
  const birthDate = form.watch('birthDate')
  const heightCm = form.watch('heightCm')
  const weightKg = form.watch('weightKg')
  const activityLevel = form.watch('activityLevel')
  const goal = form.watch('goal')

  const canCalculate =
    !!sex &&
    !!birthDate &&
    typeof heightCm === 'number' &&
    typeof weightKg === 'number' &&
    !!activityLevel &&
    !!goal

  let targets = null
  if (canCalculate) {
    const age = calculateAge(new Date(birthDate))
    const bmr = calculateBMR({ sex, ageYears: age, heightCm, weightKg })
    const tdee = calculateTDEE(bmr, activityLevel)
    targets = calculateMacroTargets({ tdee, goal, weightKg })
  }

  const cards = [
    { label: 'Calorias', value: targets?.calorieTarget, unit: 'kcal' },
    { label: 'Proteína', value: targets?.proteinTarget, unit: 'g' },
    { label: 'Carboidrato', value: targets?.carbTarget, unit: 'g' },
    { label: 'Gordura', value: targets?.fatTarget, unit: 'g' },
  ]

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Suas metas diárias</h2>
        <p className="text-sm text-muted-foreground">
          Calculadas a partir dos dados que você informou.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-md border border-input p-3 text-center"
          >
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className="text-2xl font-semibold">
              {c.value ?? '--'}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                {c.unit}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Você pode ajustar essas metas depois no seu perfil.
      </p>
    </div>
  )
}
