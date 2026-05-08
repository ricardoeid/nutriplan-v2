import type { UseFormReturn } from 'react-hook-form'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import type { CustomFoodFormData } from '../lib/schemas'

interface FoodFormFieldsProps {
  form: UseFormReturn<CustomFoodFormData>
}

// Campos básicos do food, compartilhados entre os dois modos de input.
// Ordem: identificação → porção → flag de arredondamento.
//
// Para inputs numéricos, usamos `valueAsNumber: true` no register
// (RHF converte string→number automaticamente). Campo vazio vira
// `NaN`, que o zod rejeita com a mensagem do schema.
export function FoodFormFields({ form }: FoodFormFieldsProps) {
  const {
    register,
    formState: { errors },
  } = form

  return (
    <div className="space-y-4">
      {/* Nome — sempre obrigatório */}
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome *</Label>
        <Input
          id="name"
          placeholder="Ex: Whey Protein Chocolate"
          {...register('name')}
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Marca — opcional */}
      <div className="space-y-1.5">
        <Label htmlFor="brand">Marca (opcional)</Label>
        <Input
          id="brand"
          placeholder="Ex: Growth Supplements"
          {...register('brand')}
        />
        {errors.brand && (
          <p className="text-xs text-destructive">{errors.brand.message}</p>
        )}
      </div>

      {/* Peso da porção padrão */}
      <div className="space-y-1.5">
        <Label htmlFor="defaultServingG">Peso da porção (g) *</Label>
        <Input
          id="defaultServingG"
          type="number"
          inputMode="decimal"
          step="0.1"
          placeholder="Ex: 30"
          {...register('defaultServingG', { valueAsNumber: true })}
        />
        {errors.defaultServingG && (
          <p className="text-xs text-destructive">
            {errors.defaultServingG.message}
          </p>
        )}
      </div>

      {/* Rótulo da porção — opcional */}
      <div className="space-y-1.5">
        <Label htmlFor="servingLabel">Rótulo da porção (opcional)</Label>
        <Input
          id="servingLabel"
          placeholder='Ex: "1 scoop", "1 unidade", "1 colher"'
          {...register('servingLabel')}
        />
        {errors.servingLabel && (
          <p className="text-xs text-destructive">
            {errors.servingLabel.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Como mostrar a porção no app. Se vazio, mostra só "{form.watch('defaultServingG') || '?'} g".
        </p>
      </div>

      {/* Flag: só múltiplos inteiros da porção */}
      <div className="flex items-start gap-2 rounded-md border border-input p-3">
        <input
          type="checkbox"
          id="recalcWholeUnitsOnly"
          className="mt-1"
          {...register('recalcWholeUnitsOnly')}
        />
        <div>
          <Label
            htmlFor="recalcWholeUnitsOnly"
            className="cursor-pointer font-medium"
          >
            Apenas múltiplos inteiros da porção
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Marque pra alimentos que só fazem sentido em unidades inteiras
            (ex: 1, 2, 3 ovos). O motor de substituição respeita essa regra.
          </p>
        </div>
      </div>
    </div>
  )
}
