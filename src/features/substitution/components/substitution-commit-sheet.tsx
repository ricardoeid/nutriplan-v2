import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type {
  ItemAdjustment,
  SubstitutionResult,
} from '../lib/types'

interface SubstitutionCommitSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  result: SubstitutionResult
  targetMealName: string
  // Callback recebe lista de "itens marcados" (chosen + adjusted >0).
  // Caller monta o payload e chama useApplySubstitution.
  onConfirm: (selection: CommitSelection) => void | Promise<void>
  // Voltar volta pro review sheet (não cancelar tudo).
  onBack: () => void
  submitting?: boolean
}

// Item selecionado no commit sheet. Map para AddEntryItem no caller.
export interface CommitSelectedEntry {
  // Identificador local: 'chosen' pra o food novo, ou itemId do
  // ItemAdjustment pra os outros.
  key: string
  foodId: string
  foodName: string
  quantityG: number
  // Macros snapshot
  kcal: number
  protein: number
  carbs: number
  fat: number
  // Vinculação ao plano (null pro chosen, setado pros items)
  planSlotId: string | null
  planOptionId: string | null
  isOffPlan: boolean
}

export interface CommitSelection {
  entries: CommitSelectedEntry[]
}

// Sheet "Registrar refeição" pós-substituição (Fase 6 B6) — print 5 V1.
//
// Mostra checkboxes pré-marcados com:
//   - Chosen (food novo) com badge "Alimento novo" — sempre marcado por
//     default. User pode desmarcar (vira branch A — cancelar a
//     substituição; trata no caller).
//   - Items ajustados da refeição-alvo com qty NOVA + "(antes: Xg)" pra
//     comparação.
//
// User desmarca o que não quer comer. Total dinâmico no rodapé. Click
// "Registrar refeição" → onConfirm com items marcados → caller chama
// RPC apply_substitution. "Voltar" → review sheet de novo (estado
// preservado no flow controller).
//
// Stacked sobre o review sheet: review fica atrás semitransparente.
export function SubstitutionCommitSheet({
  open,
  onOpenChange,
  result,
  targetMealName,
  onConfirm,
  onBack,
  submitting = false,
}: SubstitutionCommitSheetProps) {
  // Rows: chosen + items ajustados não-zerados da refeição-alvo.
  // (Items zerados da target ficam só no plan_day_adjustments via RPC,
  // não viram log_entry.)
  const rows = useMemo(() => buildCommitRows(result, targetMealName), [
    result,
    targetMealName,
  ])

  // Slots/key desmarcados. Default vazio = todos marcados.
  const [deselected, setDeselected] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (open) setDeselected(new Set())
  }, [open])

  // Esc volta pro review (não cancela direto — comportamento diferente
  // do food-step). Match V1 que tinha botão "Voltar" no Print 5.
  useEffect(() => {
    if (!open) return
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onBack()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onBack, submitting])

  if (!open) return null

  const selectedRows = rows.filter((r) => !deselected.has(r.key))
  const total = selectedRows.reduce(
    (acc, r) => ({
      kcal: acc.kcal + r.kcal,
      protein: acc.protein + r.protein,
      carbs: acc.carbs + r.carbs,
      fat: acc.fat + r.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )

  const toggle = (key: string) => {
    setDeselected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleConfirm = () => {
    onConfirm({
      entries: selectedRows.map((r) => ({
        key: r.key,
        foodId: r.foodId,
        foodName: r.foodName,
        quantityG: r.quantityG,
        kcal: r.kcal,
        protein: r.protein,
        carbs: r.carbs,
        fat: r.fat,
        planSlotId: r.planSlotId,
        planOptionId: r.planOptionId,
        isOffPlan: r.isOffPlan,
      })),
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center"
      onClick={() => !submitting && onBack()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="commit-title"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-t-xl bg-background sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b p-4">
          <h2 id="commit-title" className="text-lg font-semibold">
            Registrar refeição
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Confirme o que você realmente vai comer.
          </p>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {rows.length === 0 ? (
            <p className="rounded-md border border-dashed bg-muted/40 p-3 text-center text-xs italic text-muted-foreground">
              Nada pra registrar.
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => {
                const isChecked = !deselected.has(row.key)
                return (
                  <li key={row.key}>
                    <CommitItemRow
                      foodName={row.foodName}
                      quantityG={row.quantityG}
                      originalQuantityG={row.originalQuantityG}
                      kcal={row.kcal}
                      isNew={row.isNew}
                      checked={isChecked}
                      onToggle={() => toggle(row.key)}
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
              {Math.round(total.kcal)} kcal · P {total.protein.toFixed(0)}g · C{' '}
              {total.carbs.toFixed(0)}g · G {total.fat.toFixed(0)}g
            </span>
          </p>
          <div className="space-y-2">
            <Button
              type="button"
              className="w-full"
              onClick={handleConfirm}
              disabled={submitting || selectedRows.length === 0}
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
              onClick={onBack}
              disabled={submitting}
            >
              Voltar
            </Button>
          </div>
        </div>
      </div>
      {/* onOpenChange é exposto pro caller fechar tudo programaticamente */}
      {/* mas a UI deste sheet sempre usa onBack (voltar pro review).      */}
      {void onOpenChange}
    </div>
  )
}

// ─── CommitItemRow ──────────────────────────────────────────────────

interface CommitRow {
  key: string
  foodId: string
  foodName: string
  quantityG: number
  originalQuantityG: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  isNew: boolean // chosen = true
  planSlotId: string | null
  planOptionId: string | null
  isOffPlan: boolean
}

function buildCommitRows(
  result: SubstitutionResult,
  _targetMealName: string,
): CommitRow[] {
  void _targetMealName
  const rows: CommitRow[] = []

  // 1. Chosen (food novo) — sempre primeiro, badge "Alimento novo"
  rows.push({
    key: 'chosen',
    foodId: result.chosen.food.id,
    foodName: result.chosen.food.name,
    quantityG: result.chosen.quantityG,
    originalQuantityG: result.chosen.quantityG, // sem original
    kcal: result.chosen.macros.kcal,
    protein: result.chosen.macros.protein,
    carbs: result.chosen.macros.carbs,
    fat: result.chosen.macros.fat,
    isNew: true,
    planSlotId: null,
    planOptionId: null,
    isOffPlan: true,
  })

  // 2. Items ajustados da refeição-alvo (não-zerados)
  for (const adj of result.targetMealAdjustments.itemAdjustments) {
    if (adj.adjustedQuantityG <= 0) continue
    const factor = adj.adjustedQuantityG / 100
    rows.push({
      key: `target-${adj.itemId}`,
      foodId: adj.food.id,
      foodName: adj.food.name,
      quantityG: adj.adjustedQuantityG,
      originalQuantityG: adj.originalQuantityG,
      kcal: adj.food.kcal_per_100g * factor,
      protein: adj.food.protein_per_100g * factor,
      carbs: adj.food.carb_per_100g * factor,
      fat: adj.food.fat_per_100g * factor,
      isNew: false,
      planSlotId: null, // caller resolve se vincular ao slot (atualmente: vincula via plan_slot_id pelo ItemAdjustment, mas requer mapping pra option_item_id no payload)
      planOptionId: null,
      isOffPlan: false,
    })
  }

  return rows
}

function CommitItemRow({
  foodName,
  quantityG,
  originalQuantityG,
  kcal,
  isNew,
  checked,
  onToggle,
}: {
  foodName: string
  quantityG: number
  originalQuantityG: number
  kcal: number
  isNew: boolean
  checked: boolean
  onToggle: () => void
}) {
  const qtyChanged =
    !isNew && Math.round(quantityG) !== Math.round(originalQuantityG)
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
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-medium">{foodName}</p>
          {isNew && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              Alimento novo
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
          {Math.round(quantityG)}g
          {qtyChanged && (
            <span className="ml-1">
              (antes: {Math.round(originalQuantityG)}g)
            </span>
          )}{' '}
          · {Math.round(kcal)} kcal
        </p>
      </div>
    </button>
  )
}

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

// Helper exportado pro flow controller usar — recupera o ItemAdjustment
// pelo key gerado por buildCommitRows. Util pra montar payload do RPC
// preservando plan_slot_id/option_id (que não vivem no CommitRow pra
// não inflar UI).
export function findItemAdjustmentByKey(
  result: SubstitutionResult,
  key: string,
): ItemAdjustment | undefined {
  if (!key.startsWith('target-')) return undefined
  const itemId = key.slice('target-'.length)
  return result.targetMealAdjustments.itemAdjustments.find(
    (a) => a.itemId === itemId,
  )
}
