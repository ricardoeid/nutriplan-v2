import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  onboardingFullSchema,
  type OnboardingFullData,
} from '../lib/schemas'

export const TOTAL_STEPS = 6

// Mapa step → campos que o RHF precisa validar antes de avançar daquele
// step. Steps 5 e 6 não têm inputs editáveis (review/confirmação),
// então array vazio = nada a validar, avança direto.
const FIELDS_BY_STEP: Record<number, Array<keyof OnboardingFullData>> = {
  1: ['displayName'],
  2: ['sex', 'birthDate', 'heightCm', 'weightKg'],
  3: ['activityLevel'],
  4: ['goal'],
  5: [],
  6: [],
}

export function useOnboardingForm() {
  const [currentStep, setCurrentStep] = useState(1)

  // Defaults: undefined nos campos requeridos faz com que o usuário
  // PRECISE preencher (não tem valor mascarado). Na hora do submit do
  // Bloco 7, com schema validado, podemos confiar que tudo veio.
  const form = useForm<OnboardingFullData>({
    resolver: zodResolver(onboardingFullSchema),
    mode: 'onSubmit',
    defaultValues: {
      displayName: '',
      sex: undefined,
      birthDate: '',
      heightCm: undefined,
      weightKg: undefined,
      activityLevel: undefined,
      goal: undefined,
    },
  })

  // Valida campos do step atual antes de avançar. Se inválido, RHF
  // mostra erros e impede navegação.
  const validateAndGoNext = useCallback(async () => {
    const fields = FIELDS_BY_STEP[currentStep] ?? []
    const ok = fields.length === 0 ? true : await form.trigger(fields)
    if (ok) {
      setCurrentStep((s) => Math.min(s + 1, TOTAL_STEPS))
    }
  }, [currentStep, form])

  const goBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 1))
  }, [])

  const isFirstStep = currentStep === 1
  const isLastStep = currentStep === TOTAL_STEPS
  const progressPercent = (currentStep / TOTAL_STEPS) * 100

  return {
    form,
    currentStep,
    validateAndGoNext,
    goBack,
    isFirstStep,
    isLastStep,
    progressPercent,
  }
}
