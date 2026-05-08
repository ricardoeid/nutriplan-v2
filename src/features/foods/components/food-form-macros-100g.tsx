import type { UseFormReturn } from 'react-hook-form'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import type { CustomFoodFormData } from '../lib/schemas'

interface Props {
  form: UseFormReturn<CustomFoodFormData>
}

// Inputs de macros no modo "Por 100g". Esses valores vão direto pra
// `kcal_per_100g` etc. no banco, sem conversão.
//
// Os erros aparecem só quando o modo ativo é 'per100g' (zod do
// discriminated union ignora o outro caminho), mas TS não consegue
// refinar `errors` sozinho — o `'kcalPer100g' in errors` faz o guard
// em runtime e tipa-narrowing pelo TS.
export function FoodFormMacros100g({ form }: Props) {
  const {
    register,
    formState: { errors },
  } = form

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="kcalPer100g">Calorias (kcal / 100 g) *</Label>
        <Input
          id="kcalPer100g"
          type="number"
          inputMode="decimal"
          step="0.1"
          placeholder="Ex: 380"
          {...register('kcalPer100g', { valueAsNumber: true })}
        />
        {'kcalPer100g' in errors && errors.kcalPer100g?.message && (
          <p className="text-xs text-destructive">
            {errors.kcalPer100g.message}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="proteinPer100g">Proteína (g) *</Label>
          <Input
            id="proteinPer100g"
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder="0"
            {...register('proteinPer100g', { valueAsNumber: true })}
          />
          {'proteinPer100g' in errors && errors.proteinPer100g?.message && (
            <p className="text-xs text-destructive">
              {errors.proteinPer100g.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="carbPer100g">Carbo (g) *</Label>
          <Input
            id="carbPer100g"
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder="0"
            {...register('carbPer100g', { valueAsNumber: true })}
          />
          {'carbPer100g' in errors && errors.carbPer100g?.message && (
            <p className="text-xs text-destructive">
              {errors.carbPer100g.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fatPer100g">Gord (g) *</Label>
          <Input
            id="fatPer100g"
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder="0"
            {...register('fatPer100g', { valueAsNumber: true })}
          />
          {'fatPer100g' in errors && errors.fatPer100g?.message && (
            <p className="text-xs text-destructive">
              {errors.fatPer100g.message}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
