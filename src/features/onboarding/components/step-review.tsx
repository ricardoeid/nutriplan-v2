import { type UseFormReturn } from 'react-hook-form'

import {
  formatActivityLevel,
  formatDateBR,
  formatGoal,
  formatSex,
} from '@/lib/utils-format'
import { type OnboardingFullData } from '../lib/schemas'

interface Props {
  form: UseFormReturn<OnboardingFullData>
}

export function StepReview({ form }: Props) {
  const data = form.watch()

  const rows: Array<[string, string]> = [
    ['Nome', data.displayName ?? '--'],
    ['Sexo', data.sex ? formatSex(data.sex) : '--'],
    ['Nascimento', data.birthDate ? formatDateBR(data.birthDate) : '--'],
    [
      'Altura',
      typeof data.heightCm === 'number' ? `${data.heightCm} cm` : '--',
    ],
    ['Peso', typeof data.weightKg === 'number' ? `${data.weightKg} kg` : '--'],
    [
      'Atividade',
      data.activityLevel ? formatActivityLevel(data.activityLevel) : '--',
    ],
    ['Objetivo', data.goal ? formatGoal(data.goal) : '--'],
  ]

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Confira tudo</h2>
        <p className="text-sm text-muted-foreground">
          Você pode editar depois nas configurações.
        </p>
      </div>

      <dl className="space-y-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex justify-between border-b border-input pb-2 text-sm"
          >
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
