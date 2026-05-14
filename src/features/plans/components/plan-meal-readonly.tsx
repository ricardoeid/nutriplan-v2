import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Clock } from 'lucide-react'

import {
  type PlanTreeMealRaw,
  type PlanTreeOptionRaw,
  type PlanTreeSlotRaw,
  pgTimeToHHMM,
} from '../lib/draft-types'

interface PlanMealReadonlyProps {
  meal: PlanTreeMealRaw
}

// Card read-only de UMA refeição do plano ativo aplicado a hoje (B6).
//
// Layout (modelo simplificado da Fase 5):
//   ┌─ Café da manhã                          07:00 ─┐
//   │ ≈ 489 kcal · P 27g · C 55g · G 18g             │
//   ├────────────────────────────────────────────────┤
//   │ FRUTAS                              95 kcal    │
//   │ Mamão papaya — 150g                            │
//   │ ▸ Ver 2 alternativas                           │
//   ├────────────────────────────────────────────────┤
//   │ PROTEÍNA                           234 kcal    │
//   │ Ovo cozido — 165g                              │
//   │ (sem alternativas)                             │
//   └────────────────────────────────────────────────┘
//
// Conceitos:
//   - "Alimento" (slot) = entrada na refeição, com label opcional
//   - "Alternativa" (option) = food + qty (1:1)
//   - Principal = primeira alternativa (menor sort_order)
//   - Totais da refeição = soma da alternativa principal de cada
//     alimento (evita ambiguidade de "qual alternativa pesar")
//
// Out of scope (Fase 6+):
//   - "toque para escolher" + click handler pra registrar troca em
//     plan_day_adjustments
//   - Overlay do que foi comido hoje
//   - "Registrar esta refeição" pra logar a principal de uma vez
export function PlanMealReadonly({ meal }: PlanMealReadonlyProps) {
  const time = pgTimeToHHMM(meal.target_time)

  const sortedSlots = useMemo(
    () => [...meal.slots].sort((a, b) => a.sort_order - b.sort_order),
    [meal.slots],
  )

  // Totais da refeição = soma da alternativa principal (item[0]) de
  // cada alimento.
  const totals = useMemo(() => {
    return sortedSlots.reduce(
      (acc, slot) => {
        const primary = primaryOption(slot)
        if (!primary) return acc
        const m = optionMacros(primary)
        return {
          kcal: acc.kcal + m.kcal,
          p: acc.p + m.p,
          c: acc.c + m.c,
          g: acc.g + m.g,
        }
      },
      { kcal: 0, p: 0, c: 0, g: 0 },
    )
  }, [sortedSlots])

  return (
    <article className="rounded-xl border bg-card">
      <header className="border-b p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-base font-semibold">{meal.name}</h3>
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
        <p className="p-3 text-center text-xs italic text-muted-foreground">
          Refeição sem alimentos planejados.
        </p>
      ) : (
        <ul className="divide-y">
          {sortedSlots.map((slot, idx) => (
            <li key={slot.id} className="p-3">
              <SlotView slot={slot} fallbackLabel={`ITEM ${idx + 1}`} />
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

// ─── SlotView ───────────────────────────────────────────────────────

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
  const altLabel = altCount === 1 ? '1 alternativa' : `${altCount} alternativas`

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

// ─── Alternativa (não-principal) ────────────────────────────────────

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

// ─── Helpers de cálculo ─────────────────────────────────────────────

function primaryOption(
  slot: PlanTreeSlotRaw,
): PlanTreeOptionRaw | undefined {
  if (slot.options.length === 0) return undefined
  return [...slot.options].sort((a, b) => a.sort_order - b.sort_order)[0]
}

function optionMacros(option: PlanTreeOptionRaw): {
  kcal: number
  p: number
  c: number
  g: number
} {
  // UI força 1 item por option, mas pra ser defensivo com planos
  // antigos com items extras, soma todos. Quando a UI nova reescrever
  // o plano, items extras desaparecem no save.
  return option.items.reduce(
    (acc, item) => {
      const factor = Number(item.quantity_g) / 100
      return {
        kcal: acc.kcal + item.food.kcal_per_100g * factor,
        p: acc.p + item.food.protein_per_100g * factor,
        c: acc.c + item.food.carb_per_100g * factor,
        g: acc.g + item.food.fat_per_100g * factor,
      }
    },
    { kcal: 0, p: 0, c: 0, g: 0 },
  )
}
