import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Clock, Shuffle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { AddEntryItem } from '@/features/log/hooks/use-add-entries'
import type { Database } from '@/types/database'

import {
  type PlanTreeMealRaw,
  type PlanTreeOptionRaw,
  type PlanTreeSlotRaw,
  pgTimeToHHMM,
} from '../lib/draft-types'
import { foodMacrosAtQty } from '../lib/option-macros'
import type { SetAdjustmentInput } from '../hooks/use-day-adjustments'
import { MealCommitSheet } from './meal-commit-sheet'

type PlanDayAdjustment =
  Database['public']['Tables']['plan_day_adjustments']['Row']

interface ProximaRefeicaoCardProps {
  meal: PlanTreeMealRaw
  planId: string
  todayISO: string
  adjustmentsBySlotId: Map<string, PlanDayAdjustment>
  onChangeAlternativa: (input: SetAdjustmentInput) => void
  onResetAlternativa: (slotId: string) => void
  // Fase 6 B3: callbacks pra "Registrar esta refeição".
  //   - logMealId: id da log_meal correspondente a esta plan_meal no
  //     daily_log de hoje. Null se ainda não existe (caso raríssimo —
  //     activate_meal_plan deveria ter seedado).
  //   - onRegisterRefeicao: callback pro parent (que tem a mutation
  //     useAddEntries — Regra 14). Recebe array de entries pré-construídas
  //     pelo MealCommitSheet (slots marcados + qty + macros + plan refs).
  //   - registering: enquanto true, MealCommitSheet desabilita botões e
  //     mostra "Registrando..." pra evitar dupla submissão.
  logMealId: string | null
  // Async pra que o card consiga await + fechar o sheet em sucesso.
  // Parent (PlanoPage) lança em erro pra manter sheet aberto.
  onRegisterRefeicao: (entries: AddEntryItem[]) => Promise<void>
  registering: boolean
  // Fase 6 B3.5: True se esta refeição tem 1+ adjustment ativo hoje.
  // Mostra badge "Ajustado hoje" sutil no header.
  hasAdjustments: boolean
}

// Card "PRÓXIMA REFEIÇÃO" destacado (Fase 6 B1 + B2).
//
// B1: layout do card com label "PRÓXIMA REFEIÇÃO", header com totais,
// lista de slots com "> Ver N alternativas" expansível.
//
// B2: alternativas viram CLICÁVEIS. Click numa alternativa não-principal
// chama onChangeAlternativa (insere/atualiza plan_day_adjustments).
// Click na alternativa marcada PRINCIPAL (que migrou pra expandida)
// chama onResetAlternativa (deleta o adjustment, volta pro estado natural).
//
// Regras visuais:
//   - Linha grande do slot = opção ATIVA do dia (overlay com adjustment;
//     se sem adjustment, sort_order=0 do plano).
//   - Lista expandida = todas as outras opções (= não a ativa).
//   - Badge "PRINCIPAL" aparece SÓ quando a sort_order=0 está na
//     expandida — ou seja, quando há adjustment ativo. Estado natural
//     (sort_order=0 na linha grande) não tem badge. Decisão de produto
//     (Ricardo, 2026-05-15): badge só sinaliza "migrou", não "é o
//     principal sempre".
//   - Macros do header e do slot refletem dinamicamente a ativa.
//
// Out of scope (próximos blocos):
//   - "Registrar esta refeição" funcional → B3.
//   - "Quero comer outra coisa" funcional → B5 + B6 (engine + sheets).
//   - Estes 2 botões ficam DISABLED com title="Em breve".
export function ProximaRefeicaoCard({
  meal,
  planId,
  todayISO,
  adjustmentsBySlotId,
  onChangeAlternativa,
  onResetAlternativa,
  logMealId,
  onRegisterRefeicao,
  registering,
  hasAdjustments,
}: ProximaRefeicaoCardProps) {
  const time = pgTimeToHHMM(meal.target_time)
  const [commitSheetOpen, setCommitSheetOpen] = useState(false)

  const sortedSlots = useMemo(
    () => [...meal.slots].sort((a, b) => a.sort_order - b.sort_order),
    [meal.slots],
  )

  // Totais da refeição = soma das opções ATIVAS de cada slot (com qty
  // do adjustment se há, senão da option cadastrada).
  const totals = useMemo(() => {
    return sortedSlots.reduce(
      (acc, slot) => {
        const adj = adjustmentsBySlotId.get(slot.id)
        const active = activeOption(slot, adj)
        if (!active) return acc
        const item = active.items[0]
        if (!item) return acc
        const qty = adj
          ? Number(adj.adjusted_quantity_g)
          : Number(item.quantity_g)
        const m = foodMacrosAtQty(item.food, qty)
        return {
          kcal: acc.kcal + m.kcal,
          p: acc.p + m.p,
          c: acc.c + m.c,
          g: acc.g + m.g,
        }
      },
      { kcal: 0, p: 0, c: 0, g: 0 },
    )
  }, [sortedSlots, adjustmentsBySlotId])

  return (
    <article className="overflow-hidden rounded-xl border bg-card">
      <header className="bg-muted/40 px-4 pb-3 pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Próxima refeição
        </p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h2 className="truncate text-xl font-semibold">{meal.name}</h2>
            {hasAdjustments && (
              <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Ajustado hoje
              </span>
            )}
          </div>
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
              <SlotView
                slot={slot}
                fallbackLabel={`ITEM ${idx + 1}`}
                adjustment={adjustmentsBySlotId.get(slot.id)}
                onPickAlternative={(option) =>
                  onChangeAlternativa({
                    dateISO: todayISO,
                    plan_id: planId,
                    plan_meal_id: meal.id,
                    plan_slot_id: slot.id,
                    plan_option_id: option.id,
                    option_item_id: option.items[0]!.id,
                    adjusted_quantity_g: Number(option.items[0]!.quantity_g),
                  })
                }
                onResetToPrincipal={() => onResetAlternativa(slot.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 border-t bg-background p-3">
        <Button
          type="button"
          className="w-full"
          onClick={() => setCommitSheetOpen(true)}
          disabled={!logMealId || sortedSlots.length === 0 || registering}
          title={!logMealId ? 'Refeição não encontrada no diário' : undefined}
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

      {logMealId && (
        <MealCommitSheet
          open={commitSheetOpen}
          onOpenChange={setCommitSheetOpen}
          meal={meal}
          adjustmentsBySlotId={adjustmentsBySlotId}
          logMealId={logMealId}
          onConfirm={async (entries) => {
            try {
              await onRegisterRefeicao(entries)
              setCommitSheetOpen(false)
            } catch {
              // toast de erro foi disparado no parent;
              // sheet fica aberto pro user tentar de novo
            }
          }}
          submitting={registering}
        />
      )}
    </article>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────

// Retorna a "ativa" do slot considerando o adjustment do dia.
// Sem adjustment → sort_order=0 (principal do plano).
// Com adjustment → option apontada pelo adjustment; se não achar (caso
// edge — option deletada do plano), cai pro sort_order=0 como fallback
// defensivo.
function activeOption(
  slot: PlanTreeSlotRaw,
  adjustment: PlanDayAdjustment | undefined,
): PlanTreeOptionRaw | undefined {
  const sorted = [...slot.options].sort((a, b) => a.sort_order - b.sort_order)
  if (sorted.length === 0) return undefined
  if (!adjustment) return sorted[0]
  return sorted.find((o) => o.id === adjustment.plan_option_id) ?? sorted[0]
}

// ─── SlotView ───────────────────────────────────────────────────────

function SlotView({
  slot,
  fallbackLabel,
  adjustment,
  onPickAlternative,
  onResetToPrincipal,
}: {
  slot: PlanTreeSlotRaw
  fallbackLabel: string
  adjustment: PlanDayAdjustment | undefined
  onPickAlternative: (option: PlanTreeOptionRaw) => void
  onResetToPrincipal: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  const sortedOptions = useMemo(
    () => [...slot.options].sort((a, b) => a.sort_order - b.sort_order),
    [slot.options],
  )
  const principal = sortedOptions[0]
  const active = activeOption(slot, adjustment)

  if (!principal || !active) {
    return (
      <div>
        <SlotHeader label={slot.label ?? fallbackLabel} kcal={null} />
        <p className="text-xs italic text-muted-foreground">
          Alimento sem alternativas.
        </p>
      </div>
    )
  }

  // Alternativas = todas as options exceto a ativa.
  const alternatives = sortedOptions.filter((o) => o.id !== active.id)

  // Macros e qty da ativa — usa qty do adjustment se há, senão da
  // option cadastrada.
  const activeItem = active.items[0]
  const activeQty = adjustment
    ? Number(adjustment.adjusted_quantity_g)
    : Number(activeItem?.quantity_g ?? 0)
  const activeMacros = activeItem
    ? foodMacrosAtQty(activeItem.food, activeQty)
    : null

  const altCount = alternatives.length
  const altLabel =
    altCount === 1 ? '1 alternativa' : `${altCount} alternativas`

  return (
    <div>
      <SlotHeader
        label={slot.label ?? fallbackLabel}
        kcal={activeMacros ? activeMacros.kcal : null}
      />

      {activeItem ? (
        <p className="text-sm font-medium">
          {activeItem.food.name}
          <span className="ml-1 font-normal text-muted-foreground tabular-nums">
            — {activeQty}g
          </span>
        </p>
      ) : (
        <p className="text-xs italic text-muted-foreground">
          Alternativa ativa sem alimento.
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
              {alternatives.map((alt) => {
                const isPrincipal = alt.id === principal.id
                return (
                  <li key={alt.id}>
                    <AlternativeView
                      option={alt}
                      isPrincipal={isPrincipal}
                      onClick={() => {
                        if (isPrincipal) {
                          onResetToPrincipal()
                        } else {
                          onPickAlternative(alt)
                        }
                      }}
                    />
                  </li>
                )
              })}
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

function AlternativeView({
  option,
  isPrincipal,
  onClick,
}: {
  option: PlanTreeOptionRaw
  isPrincipal: boolean
  onClick: () => void
}) {
  const item = option.items[0]
  if (!item) {
    return (
      <p className="text-xs italic text-muted-foreground">
        Alternativa sem alimento.
      </p>
    )
  }
  const qty = Number(item.quantity_g)
  const macros = foodMacrosAtQty(item.food, qty)
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-md p-1.5 text-left transition-colors hover:bg-muted/60"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {isPrincipal && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
            Principal
          </span>
        )}
        <p className="text-sm">
          {item.food.name}
          <span className="ml-1 text-muted-foreground tabular-nums">
            — {qty}g
          </span>
        </p>
      </div>
      <p className="text-xs tabular-nums text-muted-foreground">
        {Math.round(macros.kcal)} kcal
      </p>
    </button>
  )
}
