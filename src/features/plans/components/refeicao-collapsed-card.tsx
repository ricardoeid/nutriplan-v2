import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
} from 'lucide-react'

import type { LogEntryWithFood } from '@/features/log/lib/types'

import { type PlanTreeMealRaw, pgTimeToHHMM } from '../lib/draft-types'
import type { MealStatus } from '../lib/meal-status'
import { primaryOption } from '../lib/option-macros'

interface RefeicaoCollapsedCardProps {
  meal: PlanTreeMealRaw
  status: Exclude<MealStatus, 'next'>
  entries: LogEntryWithFood[]
}

// Card colapsado de uma refeição que NÃO é a próxima (Fase 6 B1).
// Layout-alvo: print V1 do /plano, refeições abaixo do destaque.
//
// Estados visuais (ícone à esquerda do nome):
//   - past-eaten  → CheckCircle2 verde (refeição já logada)
//   - past-empty  → Circle outline cinza (passou e não logou)
//   - future      → Circle outline cinza (mesmo ícone, sem destaque)
//
// Quando expandido:
//   - past-eaten → lista as entries do diário (o que foi comido)
//   - past-empty/future → lista os items planejados (alternativa principal
//                         de cada slot)
export function RefeicaoCollapsedCard({
  meal,
  status,
  entries,
}: RefeicaoCollapsedCardProps) {
  const [expanded, setExpanded] = useState(false)
  const time = pgTimeToHHMM(meal.target_time)

  return (
    <article className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/40"
      >
        {status === 'past-eaten' ? (
          <CheckCircle2
            className="h-5 w-5 shrink-0 text-green-500"
            aria-hidden
          />
        ) : (
          <Circle
            className="h-5 w-5 shrink-0 text-muted-foreground"
            aria-hidden
          />
        )}
        <span className="flex-1 truncate text-sm font-medium">
          {meal.name}
        </span>
        {time && (
          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular-nums">
            <Clock className="h-3.5 w-3.5" />
            {time}
          </span>
        )}
        {expanded ? (
          <ChevronDown
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        ) : (
          <ChevronRight
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        )}
      </button>

      {expanded && (
        <div className="border-t bg-background p-3">
          {status === 'past-eaten' ? (
            <EntriesList entries={entries} />
          ) : (
            <PlannedItemsList meal={meal} />
          )}
        </div>
      )}
    </article>
  )
}

function EntriesList({ entries }: { entries: LogEntryWithFood[] }) {
  if (entries.length === 0) {
    // Defensivo: status='past-eaten' implica entries.length > 0, mas
    // se isso falhar caímos num empty-state silencioso em vez de UI
    // quebrada.
    return (
      <p className="text-xs italic text-muted-foreground">
        Sem registros nessa refeição.
      </p>
    )
  }
  return (
    <ul className="space-y-1.5">
      {entries.map((entry) => (
        <li key={entry.id} className="text-sm">
          {entry.food?.name ?? (
            <span className="italic text-muted-foreground">
              Alimento removido
            </span>
          )}
          <span className="ml-1 text-muted-foreground tabular-nums">
            — {Number(entry.quantity_g)}g
          </span>
        </li>
      ))}
    </ul>
  )
}

function PlannedItemsList({ meal }: { meal: PlanTreeMealRaw }) {
  const sortedSlots = useMemo(
    () => [...meal.slots].sort((a, b) => a.sort_order - b.sort_order),
    [meal.slots],
  )

  if (sortedSlots.length === 0) {
    return (
      <p className="text-xs italic text-muted-foreground">
        Refeição sem alimentos planejados.
      </p>
    )
  }

  return (
    <ul className="space-y-1.5">
      {sortedSlots.map((slot, idx) => {
        const primary = primaryOption(slot)
        const item = primary?.items[0]
        const fallback = slot.label ?? `Item ${idx + 1}`
        if (!item) {
          return (
            <li
              key={slot.id}
              className="text-sm italic text-muted-foreground"
            >
              {fallback} — sem alternativa
            </li>
          )
        }
        return (
          <li key={slot.id} className="text-sm">
            {item.food.name}
            <span className="ml-1 text-muted-foreground tabular-nums">
              — {Number(item.quantity_g)}g
            </span>
          </li>
        )
      })}
    </ul>
  )
}
