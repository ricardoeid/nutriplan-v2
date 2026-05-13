import { cn } from '@/lib/utils'
import type { FoodSearchResult } from '@/features/foods/lib/types'

interface FoodPickerRowProps {
  food: FoodSearchResult
  onSelect: (food: FoodSearchResult) => void
}

// Versão simplificada de FoodRow pra uso no AddFoodFlow. Diferenças:
//   - Click na row inteira seleciona o food (não navega pra detail)
//   - Sem estrela favoritar (foco é só selecionar pra logar)
//   - Sem menu ••• (não tem ações secundárias)
//   - Badge de fonte mantida (ajuda identificar TACO / Produto / Meu)
//
// Reusa SOURCE_BADGES inline porque o objeto vive em food-row.tsx e
// extrair pra arquivo separado seria 1 import a mais pra economia
// pequena. Se aparecer 3º consumidor, extraímos.

const SOURCE_BADGES: Record<
  string,
  { label: string; className: string }
> = {
  taco: {
    label: 'TACO',
    className:
      'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
  },
  open_food_facts: {
    label: 'Produto',
    className: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
  },
  composite: {
    label: 'Receita',
    className: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
  },
  custom: {
    label: 'Meu',
    className:
      'bg-violet-500/10 text-violet-700 border-violet-500/30',
  },
}

function getSourceBadge(source: string) {
  return (
    SOURCE_BADGES[source] ?? {
      label: source,
      className: 'bg-muted text-muted-foreground border-border',
    }
  )
}

function formatGrams(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })
}

export function FoodPickerRow({ food, onSelect }: FoodPickerRowProps) {
  const badge = getSourceBadge(food.source)
  const kcalDisplay = Math.round(food.kcal_per_100g).toLocaleString('pt-BR')

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(food)}
        className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="truncate font-medium block">{food.name}</span>
            {food.brand && (
              <span className="truncate text-xs text-muted-foreground block">
                {food.brand}
              </span>
            )}
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
              badge.className,
            )}
          >
            {badge.label}
          </span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {kcalDisplay} kcal
          </span>
          {' / 100 g · '}
          P {formatGrams(food.protein_per_100g)} g · C{' '}
          {formatGrams(food.carb_per_100g)} g · G{' '}
          {formatGrams(food.fat_per_100g)} g
        </div>
      </button>
    </li>
  )
}
