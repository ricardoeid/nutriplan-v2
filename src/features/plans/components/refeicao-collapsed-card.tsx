import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { LogEntryWithFood } from '@/features/log/lib/types'
import type { Database } from '@/types/database'

import {
  type PlanTreeMealRaw,
  type PlanTreeSlotRaw,
  pgTimeToHHMM,
} from '../lib/draft-types'
import type { MealStatus } from '../lib/meal-status'
import { primaryOption } from '../lib/option-macros'

type PlanDayAdjustment =
  Database['public']['Tables']['plan_day_adjustments']['Row']

interface RefeicaoCollapsedCardProps {
  meal: PlanTreeMealRaw
  status: Exclude<MealStatus, 'next'>
  entries: LogEntryWithFood[]
  // Map de adjustments do dia (do useTodaysPlan). Quando uma refeição
  // não-destacada estiver expandida em 'past-empty'/'future', a lista
  // de items planejados respeita o overlay (mostra a opção ativa de
  // cada slot, não a primária do plano). Apenas display — refeições
  // não-destacadas não permitem trocar alternativa (B2 decisão).
  adjustmentsBySlotId: Map<string, PlanDayAdjustment>
  // Fase 6 B3.5: True se esta refeição tem 1+ adjustment ativo hoje.
  // Mostra badge sutil "Ajustado hoje" no header (igual V1).
  hasAdjustments: boolean
  // Fase 6 B3.5: callback opcional pra "Abrir refeição" — força este
  // card a virar o destacado (PRÓXIMA REFEIÇÃO) no parent via
  // forcedNextMealId. Use case: registrar refeição esquecida ou rever
  // detalhes. Pra voltar pro automático, refresh.
  onAbrirRefeicao?: () => void
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
  adjustmentsBySlotId,
  hasAdjustments,
  onAbrirRefeicao,
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
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-sm font-medium">{meal.name}</span>
          {hasAdjustments && <AjustadoBadge />}
        </div>
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
        <div className="space-y-3 border-t bg-background p-3">
          {status === 'past-eaten' ? (
            <EntriesList entries={entries} />
          ) : (
            <PlannedItemsList
              meal={meal}
              adjustmentsBySlotId={adjustmentsBySlotId}
            />
          )}
          {onAbrirRefeicao && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onAbrirRefeicao}
            >
              Abrir refeição
            </Button>
          )}
        </div>
      )}
    </article>
  )
}

// Badge sutil "Ajustado hoje" — sinaliza que esta refeição tem pelo
// menos 1 adjustment ativo no plan_day_adjustments. Visualmente igual
// ao V1 (tag pequena, fundo neutro).
function AjustadoBadge() {
  return (
    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      Ajustado hoje
    </span>
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

function PlannedItemsList({
  meal,
  adjustmentsBySlotId,
}: {
  meal: PlanTreeMealRaw
  adjustmentsBySlotId: Map<string, PlanDayAdjustment>
}) {
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
        const adjustment = adjustmentsBySlotId.get(slot.id)
        const active = pickActiveOption(slot, adjustment)
        const item = active?.items[0]
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
        const qty = adjustment
          ? Number(adjustment.adjusted_quantity_g)
          : Number(item.quantity_g)
        return (
          <li key={slot.id} className="text-sm">
            {item.food.name}
            <span className="ml-1 text-muted-foreground tabular-nums">
              — {qty}g
            </span>
          </li>
        )
      })}
    </ul>
  )
}

// Retorna a opção ativa do slot considerando o adjustment do dia.
// Sem adjustment → primária do plano (sort_order=0).
// Com adjustment → option apontada; fallback defensivo na primária se
// não achar (option deletada do plano).
function pickActiveOption(
  slot: PlanTreeSlotRaw,
  adjustment: PlanDayAdjustment | undefined,
) {
  if (!adjustment) return primaryOption(slot)
  return (
    slot.options.find((o) => o.id === adjustment.plan_option_id) ??
    primaryOption(slot)
  )
}
