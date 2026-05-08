import { Star } from 'lucide-react'

import { cn } from '@/lib/utils'

import type { FoodSearchResult } from '../lib/types'

interface FoodRowProps {
  food: FoodSearchResult
  // Disparado ao clicar a estrela. Parent recebe o food atual e
  // decide o que fazer (toggle no banco). Padrão "render dumb,
  // logic up" — row não conhece a mutation.
  onToggleFavorite: (food: FoodSearchResult) => void
  // True enquanto a mutation tá pendente — desabilita o botão pra
  // evitar duplo clique. Optimistic já reflete o estado novo no
  // food.is_favorite, então o ícone visual já tá correto.
  isFavoritePending?: boolean
}

// Mapeamento source → badge. Cores via classes Tailwind literais
// (não tokens CSS do shadcn) porque shadcn classic não tem variantes
// de cor pra essa convenção. Padrão `/10 + /30` segue blueprint.
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

// Formata grama com no máx 1 casa decimal e sem zeros à direita.
// pt-BR usa vírgula como separador (28 → "28", 2.5 → "2,5", 0 → "0").
function formatGrams(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })
}

export function FoodRow({
  food,
  onToggleFavorite,
  isFavoritePending = false,
}: FoodRowProps) {
  const badge = getSourceBadge(food.source)
  const kcalDisplay = Math.round(food.kcal_per_100g).toLocaleString('pt-BR')

  return (
    <li className="rounded-md border border-border bg-card px-3 py-2.5 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium">{food.name}</span>
          </div>
          {food.brand && (
            <div className="truncate text-xs text-muted-foreground">
              {food.brand}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
              badge.className,
            )}
          >
            {badge.label}
          </span>
          <button
            type="button"
            onClick={() => onToggleFavorite(food)}
            disabled={isFavoritePending}
            aria-label={
              food.is_favorite ? 'Remover dos favoritos' : 'Favoritar'
            }
            aria-pressed={food.is_favorite}
            className={cn(
              'rounded-sm p-1 transition-colors disabled:opacity-50',
              food.is_favorite
                ? 'text-amber-500 hover:bg-amber-500/10'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Star
              className={cn(
                'h-4 w-4',
                food.is_favorite && 'fill-current',
              )}
            />
          </button>
        </div>
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
    </li>
  )
}
