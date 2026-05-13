import { useEffect, useState } from 'react'

import type { FoodSearchResult } from '@/features/foods/lib/types'

import type { LogMealWithEntries } from '../lib/types'

import { AddFoodMealPickerStep } from './add-food-meal-picker-step'
import { AddFoodQuantityStep } from './add-food-quantity-step'

interface AddFoodSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  meals: LogMealWithEntries[]
  // Quando aberto a partir de MealCard "+ Adicionar alimento", já vem
  // com a meal selecionada → pula step 1 e abre direto na quantity.
  // Quando aberto a partir de /foods (B8), vem undefined → step 1 primeiro.
  preSelectedMealId: string | undefined
  onConfirm: (params: {
    mealId: string
    food: FoodSearchResult
    quantityG: number
  }) => void
  submitting: boolean
}

type Step = 'meal' | 'quantity'

// Sheet wrapper do AddFoodFlow. Match visual NewMealDialog:
//   - Mobile (< 640px): bottom-sheet com max-h-[90vh] + scroll interno
//   - Desktop (≥ 640px): modal centralizado max-w-md
//
// Gerencia state de step + meal selecionada interno. Reseta tudo no
// fechamento.
export function AddFoodSheet({
  open,
  onOpenChange,
  meals,
  preSelectedMealId,
  onConfirm,
  submitting,
}: AddFoodSheetProps) {
  // Initial step depende de se já vem meal pré-selecionada
  const [step, setStep] = useState<Step>(
    preSelectedMealId ? 'quantity' : 'meal',
  )
  const [mealId, setMealId] = useState<string | undefined>(preSelectedMealId)

  // Reset quando abre (capture-current de preSelectedMealId).
  useEffect(() => {
    if (open) {
      setStep(preSelectedMealId ? 'quantity' : 'meal')
      setMealId(preSelectedMealId)
    }
  }, [open, preSelectedMealId])

  // Esc fecha
  useEffect(() => {
    if (!open) return
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onOpenChange])

  // Body scroll-lock enquanto aberto
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  if (!open) return null

  const selectedMeal = mealId ? meals.find((m) => m.id === mealId) : undefined

  const handleQuantityConfirm = (
    food: FoodSearchResult,
    quantityG: number,
  ) => {
    if (!mealId) return
    onConfirm({ mealId, food, quantityG })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={() => onOpenChange(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-food-title"
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto space-y-4 rounded-t-xl bg-background p-4 sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="add-food-title" className="text-lg font-semibold">
          Adicionar alimento
        </h2>

        {step === 'meal' && (
          <AddFoodMealPickerStep
            meals={meals}
            onPick={(id) => {
              setMealId(id)
              setStep('quantity')
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}

        {step === 'quantity' && selectedMeal && (
          <AddFoodQuantityStep
            mealName={selectedMeal.name}
            isFirstStep={!!preSelectedMealId}
            onBack={() => {
              if (preSelectedMealId) {
                // Veio pré-selecionado, voltar = cancelar tudo
                onOpenChange(false)
              } else {
                // Voltar pro meal-picker
                setStep('meal')
              }
            }}
            onCancel={() => onOpenChange(false)}
            onConfirm={handleQuantityConfirm}
            submitting={submitting}
          />
        )}
      </div>
    </div>
  )
}
