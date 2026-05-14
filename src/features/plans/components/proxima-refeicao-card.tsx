import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Clock, Shuffle } from 'lucide-react'

import { Button } from '@/components/ui/button'

import {
  type PlanTreeMealRaw,
  type PlanTreeOptionRaw,
  type PlanTreeSlotRaw,
  pgTimeToHHMM,
} from '../lib/draft-types'
import { mealTotals, optionMacros } from '../lib/option-macros'

interface ProximaRefeicaoCardProps {
  meal: PlanTreeMealRaw
}

// Card "PRÓXIMA REFEIÇÃO" destacado (Fase 6 B1). Layout-alvo: print V1
// enviado pelo Ricardo no setup da Fase 6 (ver
// memory/project_v1_visual_reference.md indiretamente — mockup específico
// do /plano).
//
// Estados visuais:
//   - Fundo do header levemente destacado (bg-muted/40) com label
//     "PRÓXIMA REFEIÇÃO" em smallcaps.
//   - Lista de slots dentro de fundo branco (bg-background).
//   - Botões "Registrar esta refeição" (primary) e "Quero comer outra
//     coisa" (outline) no rodapé.
//
// Out of scope (próximos blocos ligam):
//   - "Registrar esta refeição" funcional → B3 (MealCommitSheet básico).
//   - "Quero comer outra coisa" funcional → B2 (sheet de alternativas
//     dentro do mesmo slot) ou B6 (escolher food novo + engine).
//   - "Ver N alternativas" como sheet de troca → B2.
//
// Botões ficam DISABLED + title="Em breve" pra deixar UI completa sem
// criar caminhos quebrados.
export function ProximaRefeicaoCard({ meal }: ProximaRefeicaoCardProps) {
  const time = pgTimeToHHMM(meal.target_time)

  const sortedSlots = useMemo(
    () => [...meal.slots].sort((a, b) => a.sort_order - b.sort_order),
    [meal.slots],
  )

  const totals = useMemo(() => mealTotals(sortedSlots), [sortedSlots])

  return (
    <article className="overflow-hidden rounded-xl border bg-card">
      <header className="bg-muted/40 px-4 pb-3 pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Próxima refeição
        </p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <h2 className="truncate text-xl font-semibold">{meal.name}</h2>
          {time && (
            <span className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground tabular-nums">
              <Clock className="h-3.5 w-3.5" />
              {time}
            </span>
          )}
        </div>
        {sortedSlots.length > 0 && (
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
            ≈ {Math.round(totals.kcal)} kcal · P {totals.p.toFixed(1)}g · C{' '}
            {totals.c.toFixed(1)}g · G {totals.g.toFixed(1)}g
          </p>
        )}
      </header>

      {sortedSlots.length === 0 ? (
        <p className="border-t bg-background p-3 text-center text-xs italic text-muted-foreground">
          Refeição sem alimentos planejados.
        </p>
      ) : (
        <ul className="divide-y border-t bg-background">
          {sortedSlots.map((slot, idx) => (
            <li key={slot.id} className="p-3">
              <SlotView slot={slot} fallbackLabel={`ITEM ${idx + 1}`} />
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 border-t bg-background p-3">
        <Button
          type="button"
          className="w-full"
          disabled
          title="Em breve"
        >
          Registrar esta refeição
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled
          title="Em breve"
        >
          <Shuffle className="mr-2 h-4 w-4" />
          Quero comer outra coisa
        </Button>
      </div>
    </article>
  )
}

// ─── SlotView ───────────────────────────────────────────────────────
//
// Cópia adaptada do SlotView original de plan-meal-readonly.tsx (Fase 5).
// Mantemos lógica idêntica de "Ver N alternativas" expansível. Quando B2
// implementar "trocar alternativa", esse bloco vira sheet — mas o B1
// só renderiza leitura.

function SlotView({
  slot,
  fallbackLabel,
}: {
  slot: PlanTreeSlotRaw
  fallbackLabel: string
}) {
  const [expanded, setExpanded] = useState(false)

  const sortedOptions = useMemo(
    () => [...slot.options].sort((a, b) => a.sort_order - b.sort_order),
    [slot.options],
  )
  const primary = sortedOptions[0]
  const alternatives = sortedOptions.slice(1)

  if (!primary) {
    return (
      <div>
        <SlotHeader label={slot.label ?? fallbackLabel} kcal={null} />
        <p className="text-xs italic text-muted-foreground">
          Alimento sem alternativas.
        </p>
      </div>
    )
  }

  const primaryFood = primary.items[0]?.food
  const primaryQty = Number(primary.items[0]?.quantity_g ?? 0)
  const primaryKcal = optionMacros(primary).kcal
  const altCount = alternatives.length
  const altLabel =
    altCount === 1 ? '1 alternativa' : `${altCount} alternativas`

  return (
    <div>
      <SlotHeader
        label={slot.label ?? fallbackLabel}
        kcal={primaryKcal}
      />

      {primaryFood ? (
        <p className="text-sm font-medium">
          {primaryFood.name}
          <span className="ml-1 font-normal text-muted-foreground tabular-nums">
            — {primaryQty}g
          </span>
        </p>
      ) : (
        <p className="text-xs italic text-muted-foreground">
          Alternativa principal sem alimento.
        </p>
      )}

      {altCount > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            Ver {altLabel}
          </button>

          {expanded && (
            <ul className="mt-2 space-y-2 border-l pl-3">
              {alternatives.map((alt) => (
                <li key={alt.id}>
                  <AlternativeView option={alt} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function SlotHeader({
  label,
  kcal,
}: {
  label: string
  kcal: number | null
}) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {kcal !== null && (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {Math.round(kcal)} kcal
        </span>
      )}
    </div>
  )
}

function AlternativeView({ option }: { option: PlanTreeOptionRaw }) {
  const item = option.items[0]
  if (!item) {
    return (
      <p className="text-xs italic text-muted-foreground">
        Alternativa sem alimento.
      </p>
    )
  }
  const qty = Number(item.quantity_g)
  const kcal = optionMacros(option).kcal
  return (
    <div>
      <p className="text-sm">
        {item.food.name}
        <span className="ml-1 text-muted-foreground tabular-nums">
          — {qty}g
        </span>
      </p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {Math.round(kcal)} kcal
      </p>
    </div>
  )
}
