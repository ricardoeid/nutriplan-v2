import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'

import type { FoodInputMode } from '../lib/schemas'

interface FoodFormModeSelectProps {
  value: FoodInputMode
  onChange: (mode: FoodInputMode) => void
  disabled?: boolean
}

// Radio entre os dois modos de entrada de macros. Em mobile (ou
// qualquer largura) os dois ficam empilhados — clarifica que cada
// um é um "modo" inteiro, não um campo entre vários.
//
// Mudar de modo limpa os campos do outro modo (responsabilidade do
// parent via `form.reset()` parcial — ver food-new.tsx).
export function FoodFormModeSelect({
  value,
  onChange,
  disabled = false,
}: FoodFormModeSelectProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Como você tem os dados?</Label>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as FoodInputMode)}
        disabled={disabled}
        className="gap-2"
      >
        <div className="flex items-start gap-2 rounded-md border border-input p-3">
          <RadioGroupItem value="per100g" id="mode-100g" className="mt-0.5" />
          <div>
            <Label htmlFor="mode-100g" className="cursor-pointer font-medium">
              Por 100 g
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Quando o rótulo mostra os valores por 100 g (típico de
              alimentos in natura).
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-md border border-input p-3">
          <RadioGroupItem
            value="perServing"
            id="mode-serving"
            className="mt-0.5"
          />
          <div>
            <Label htmlFor="mode-serving" className="cursor-pointer font-medium">
              Por porção
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Quando o rótulo mostra os valores por porção (ex: "1 unidade",
              "30 g", "1 scoop").
            </p>
          </div>
        </div>
      </RadioGroup>
    </div>
  )
}
