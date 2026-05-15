import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { AddEntryFoodInput } from '@/features/log/hooks/use-add-entry'
import type { Database } from '@/types/database'

import {
  type PlanTreeMealRaw,
  type PlanTreeOptionRaw,
  type PlanTreeSlotRaw,
} from '../lib/draft-types'
import { foodMacrosAtQty } from '../lib/option-macros'

type PlanDayAdjustment =
  Database['public']['Tables']['plan_day_adjustments']['Row']

// Slot selecionado pelo user no commit sheet. Caller (parent via card)
// resolve `logMealId` e constrói AddEntryItem[] final antes de inserir.
// Esse desacoplamento permite o caller criar a log_meal on-demand se
// foi deletada (caso edge — user deletou refeição inteira pela Home e
// quer registrar de novo via /plano).
export interface CommitSelectedSlot {
  slotId: string
  optionId: string
  food: AddEntryFoodInput
  quantityG: number
}

interface MealCommitSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  meal: PlanTreeMealRaw
  adjustmentsBySlotId: Map<string, PlanDayAdjustment>
  // Pode retornar Promise — caller (ProximaRefeicaoCard) usa pra fechar
  // o sheet só em sucesso. Sheet não precisa awaitear; mostra
  // "Registrando..." baseado em `submitting` enquanto a mutation roda.
  onConfirm: (slots: CommitSelectedSlot[]) => void | Promise<void>
  submitting?: boolean
}

// Sheet "Registrar [refeição]?" (Fase 6 B3).
//
// Pré-seleção: todos os items marcados por default (Print V1 do
// Ricardo). User desmarca slots que NÃO vai comer. Total no rodapé
// atualiza dinâmico.
//
// Items renderizados = opção ATIVA de cada slot (overlay com adjustment).
// Macros usam qty real (do adjustment se há, senão da option cadastrada).
//
// "Registrar refeição": constrói AddEntryItem[] pros slots marcados e
// chama onConfirm. Caller (plano.tsx parent) faz o batch insert via
// useAddEntries e fecha o sheet no onSuccess.
//
// "Cancelar" / Esc / click no backdrop: nada persiste.
//
// Padrão visual: mesma estratégia do food-picker-sheet (§3 padrão 11
// do STATUS) — bottom-sheet em mobile, modal centralizado em desktop,
// esc fecha, body scroll-lock.
//
// Out of scope (anotado como P23 — futuro):
//   - Ajuste automático ao desmarcar item (engine redistribui qty dos
//     outros pra manter kcal da refeição). Fica como pendência separada
//     até decisão de produto madurar.
export function MealCommitSheet({
  open,
  onOpenChange,
  meal,
  adjustmentsBySlotId,
  onConfirm,
  submitting = false,
}: MealCommitSheetProps) {
  // Slots desmarcados. Default vazio = todos marcados (pré-seleção V1).
  const [deselected, setDeselected] = useState<Set<string>>(new Set())

  // Reset quando reabre — evita carregar estado de uma abertura anterior.
  useEffect(() => {
    if (open) setDeselected(new Set())
  }, [open])

  // Esc fecha
  useEffect(() => {
    if (!open) return
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onOpenChange(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onOpenChange, submitting])

  // Body scroll-lock
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  // Linhas renderizadas — uma por slot, com option ativa, qty, macros.
  const rows = useMemo(() => {
    const sorted = [...meal.slots].sort((a, b) => a.sort_order - b.sort_order)
    return sorted
      .map((slot, idx) => {
        const adj = adjustmentsBySlotId.get(slot.id)
        const active = pickActiveOption(slot, adj)
        if (!active) return null
        const item = active.items[0]
        if (!item) return null
        const qty = adj
          ? Number(adj.adjusted_quantity_g)
          : Number(item.quantity_g)
        const macros = foodMacrosAtQty(item.food, qty)
        return {
          slotId: slot.id,
          fallbackLabel: slot.label ?? `ITEM ${idx + 1}`,
          food: item.food,
          itemId: item.id,
          optionId: active.id,
          qty,
          macros,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
  }, [meal.slots, adjustmentsBySlotId])

  // Total dinâmico — soma macros dos slots MARCADOS.
  const total = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        if (deselected.has(row.slotId)) return acc
        return {
          kcal: acc.kcal + row.macros.kcal,
          p: acc.p + row.macros.p,
          c: acc.c + row.macros.c,
          g: acc.g + row.macros.g,
        }
      },
      { kcal: 0, p: 0, c: 0, g: 0 },
    )
  }, [rows, deselected])

  if (!open) return null

  const selectedCount = rows.length - deselected.size

  const toggleSlot = (slotId: string) => {
    setDeselected((prev) => {
      const next = new Set(prev)
      if (next.has(slotId)) next.delete(slotId)
      else next.add(slotId)
      return next
    })
  }

  const handleConfirm = () => {
    const selected: CommitSelectedSlot[] = rows
      .filter((row) => !deselected.has(row.slotId))
      .map((row) => ({
        slotId: row.slotId,
        optionId: row.optionId,
        food: {
          id: row.food.id,
          name: row.food.name,
          brand: row.food.brand,
          source: row.food.source,
          serving_label: row.food.serving_label,
          default_serving_g: row.food.default_serving_g,
          kcal_per_100g: row.food.kcal_per_100g,
          protein_per_100g: row.food.protein_per_100g,
          carb_per_100g: row.food.carb_per_100g,
          fat_per_100g: row.food.fat_per_100g,
        },
        quantityG: row.qty,
      }))
    onConfirm(selected)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={() => !submitting && onOpenChange(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="meal-commit-title"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-t-xl bg-background sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b p-4">
          <h2 id="meal-commit-title" className="text-lg font-semibold">
            Registrar {meal.name}?
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Confirme o que você realmente vai comer.
          </p>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {rows.length === 0 ? (
            <p className="rounded-md border border-dashed bg-muted/40 p-3 text-center text-xs italic text-muted-foreground">
              Refeição sem alimentos planejados.
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => {
                const isChecked = !deselected.has(row.slotId)
                return (
                  <li key={row.slotId}>
                    <CommitItemRow
                      label={row.fallbackLabel}
                      foodName={row.food.name}
                      qty={row.qty}
                      kcal={row.macros.kcal}
                      checked={isChecked}
                      onToggle={() => toggleSlot(row.slotId)}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="border-t bg-muted/30 p-4">
          <p className="mb-3 text-xs tabular-nums text-muted-foreground">
            Total selecionado:{' '}
            <span className="font-medium text-foreground">
              {Math.round(total.kcal)} kcal · P {total.p.toFixed(1)}g · C{' '}
              {total.c.toFixed(1)}g · G {total.g.toFixed(1)}g
            </span>
          </p>
          <div className="space-y-2">
            <Button
              type="button"
              className="w-full"
              onClick={handleConfirm}
              disabled={submitting || selectedCount === 0}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                'Registrar refeição'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────

function pickActiveOption(
  slot: PlanTreeSlotRaw,
  adjustment: PlanDayAdjustment | undefined,
): PlanTreeOptionRaw | undefined {
  const sorted = [...slot.options].sort((a, b) => a.sort_order - b.sort_order)
  if (sorted.length === 0) return undefined
  if (!adjustment) return sorted[0]
  return sorted.find((o) => o.id === adjustment.plan_option_id) ?? sorted[0]
}

// ─── CommitItemRow ──────────────────────────────────────────────────

function CommitItemRow({
  label,
  foodName,
  qty,
  kcal,
  checked,
  onToggle,
}: {
  label: string
  foodName: string
  qty: number
  kcal: number
  checked: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={
        'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ' +
        (checked
          ? 'border-primary/30 bg-primary/5 hover:bg-primary/10'
          : 'border-border bg-card hover:bg-muted/40')
      }
      aria-pressed={checked}
    >
      <Checkbox checked={checked} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm font-medium">{foodName}</p>
        <p className="text-xs tabular-nums text-muted-foreground">
          {qty}g · {Math.round(kcal)} kcal
        </p>
      </div>
    </button>
  )
}

// Checkbox visual manual — projeto não tem @radix-ui/react-checkbox
// instalado (§0 do STATUS). Replicamos o look do shadcn checkbox com 1
// div + condicional do check icon. Acessibilidade: o pai (botão) é
// focusable e tem aria-pressed, então o leitor de tela já anuncia o
// estado. O div em si é decorativo (aria-hidden).
function Checkbox({ checked }: { checked: boolean }) {
  return (
    <div
      aria-hidden
      className={
        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ' +
        (checked
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input bg-background')
      }
    >
      {checked && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </div>
  )
}
