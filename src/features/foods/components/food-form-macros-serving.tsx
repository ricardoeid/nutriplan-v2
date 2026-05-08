import type { UseFormReturn } from 'react-hook-form'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import type { CustomFoodFormData } from '../lib/schemas'

interface Props {
  form: UseFormReturn<CustomFoodFormData>
}

// Inputs de macros no modo "Por porção". O hook converte tudo pra
// per-100g antes de salvar, mas o user nunca precisa fazer essa conta.
//
// Preview embaixo do form mostra o resultado da conversão em tempo
// real — segue regra "no mental arithmetic" do projeto: o user vê o
// que vai parar no banco, não tem que confiar em fé.
export function FoodFormMacrosServing({ form }: Props) {
  const {
    register,
    watch,
    formState: { errors },
  } = form

  // watch() reativo — re-renderiza esse componente quando os campos
  // mudam. Custo aceitável aqui (3 campos no preview).
  const servingG = watch('defaultServingG')
  const kcal = watch('kcalPerServing' as const)
  const protein = watch('proteinPerServing' as const)
  const carb = watch('carbPerServing' as const)
  const fat = watch('fatPerServing' as const)

  // Preview só faz sentido se os valores forem números válidos.
  // Number() lida com NaN sem reclamar; o `&&` filtra antes.
  const showPreview =
    typeof servingG === 'number' &&
    servingG > 0 &&
    typeof kcal === 'number' &&
    !Number.isNaN(kcal)

  const factor = showPreview ? 100 / servingG : 0
  const fmt = (n: unknown) => {
    if (typeof n !== 'number' || Number.isNaN(n)) return '—'
    return (n * factor).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="kcalPerServing">Calorias (kcal / porção) *</Label>
        <Input
          id="kcalPerServing"
          type="number"
          inputMode="decimal"
          step="0.1"
          placeholder="Ex: 120"
          {...register('kcalPerServing', { valueAsNumber: true })}
        />
        {'kcalPerServing' in errors && errors.kcalPerServing?.message && (
          <p className="text-xs text-destructive">
            {errors.kcalPerServing.message}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="proteinPerServing">Proteína (g) *</Label>
          <Input
            id="proteinPerServing"
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder="0"
            {...register('proteinPerServing', { valueAsNumber: true })}
          />
          {'proteinPerServing' in errors &&
            errors.proteinPerServing?.message && (
              <p className="text-xs text-destructive">
                {errors.proteinPerServing.message}
              </p>
            )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="carbPerServing">Carbo (g) *</Label>
          <Input
            id="carbPerServing"
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder="0"
            {...register('carbPerServing', { valueAsNumber: true })}
          />
          {'carbPerServing' in errors && errors.carbPerServing?.message && (
            <p className="text-xs text-destructive">
              {errors.carbPerServing.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fatPerServing">Gord (g) *</Label>
          <Input
            id="fatPerServing"
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder="0"
            {...register('fatPerServing', { valueAsNumber: true })}
          />
          {'fatPerServing' in errors && errors.fatPerServing?.message && (
            <p className="text-xs text-destructive">
              {errors.fatPerServing.message}
            </p>
          )}
        </div>
      </div>

      {showPreview && (
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs">
          <p className="mb-1 font-medium text-foreground">
            Preview por 100 g:
          </p>
          <p className="text-muted-foreground">
            {fmt(kcal)} kcal · P {fmt(protein)} g · C {fmt(carb)} g · G{' '}
            {fmt(fat)} g
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground/70">
            (É assim que vai ser salvo no banco)
          </p>
        </div>
      )}
    </div>
  )
}
