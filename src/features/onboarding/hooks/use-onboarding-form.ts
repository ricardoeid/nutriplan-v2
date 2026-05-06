import { useState, useCallback } from 'react'

export const TOTAL_STEPS = 6

// Hook minimal: só step atual + navegação. Dados dos forms entram no
// Bloco 5 quando RHF começar a integrar. Por enquanto navegação pura.
export function useOnboardingForm() {
  const [currentStep, setCurrentStep] = useState(1)

  const goNext = useCallback(() => {
    setCurrentStep((s) => Math.min(s + 1, TOTAL_STEPS))
  }, [])

  const goBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 1))
  }, [])

  const isFirstStep = currentStep === 1
  const isLastStep = currentStep === TOTAL_STEPS
  const progressPercent = (currentStep / TOTAL_STEPS) * 100

  return {
    currentStep,
    goNext,
    goBack,
    isFirstStep,
    isLastStep,
    progressPercent,
  }
}
