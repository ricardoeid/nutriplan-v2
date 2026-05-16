import { useEffect } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type {
  ItemAdjustment,
  MealAdjustment,
  SubstitutionMeal,
  SubstitutionResult,
} from '../lib/types'

interface SubstitutionReviewSheetProps {
  open: boolean
  // Hoje só usado pelo caller pra controlar visibilidade externa.
  // Sheet internamente fecha via onCancel (botão "Cancelar" / Esc /
  // click backdrop). Mantido na API pra simétria com outros sheets.
  onOpenChange?: (open: boolean) => void
  result: SubstitutionResult
  targetMealName: string
  futureMealsByMealId: Map<string, SubstitutionMeal>
  onConfirm: () => void
  onCancel: () => void
  submitting?: boolean
  // B7: refeições futuras que o user EXCLUIU da compensação. Default
  // vazio = todas elegíveis. Toggle no checkbox dispara re-cálculo no
  // flow controller (engine puro re-roda com novo set).
  excludedFutureMealIds: Set<string>
  onToggleExcludeFuture: (mealId: string) => void
}

// Sheet "Revisar substituição" (Fase 6 B6) — print 4 V1.
//
// Mostra o resultado do engine antes de persistir:
//   - Header: nome do chosen + qty + kcal
//   - "[REFEICAO] (AJUSTADA)" com items da refeição-alvo:
//     - removido (qty 0): strikethrough vermelho + "removido"
//     - ajustado (qty mudou): "Xg → Yg" em smallcaps cinza
//     - sem mudança: linha normal (raro mas defensivo)
//   - "PRÓXIMAS REFEIÇÕES (AJUSTADAS)" com refeições futuras impactadas
//     pela propagação, agrupadas
//   - "Resumo do dia": kcal X / Y (pct%) e proteína
//   - Warnings (3 possíveis) em caixas amarelas com ⚠
//   - Botões "Confirmar substituição" + "Cancelar"
//
// Confirmar → caller abre o commit sheet stacked.
export function SubstitutionReviewSheet({
  open,
  onOpenChange: _onOpenChange,
  result,
  targetMealName,
  futureMealsByMealId,
  onConfirm,
  onCancel,
  submitting = false,
  excludedFutureMealIds,
  onToggleExcludeFuture,
}: SubstitutionReviewSheetProps) {
  void _onOpenChange
  // Esc fecha (= cancelar)
  useEffect(() => {
    if (!open) return
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onCancel()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onCancel, submitting])

  // Body scroll-lock
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  if (!open) return null

  const { chosen, targetMealAdjustments, futureMealsAdjustments, warnings } =
    result
  const kcalPct = Math.round(result.kcalPctOfTarget)
  const proteinPct = Math.round(result.proteinPctOfTarget)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={() => !submitting && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-title"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-t-xl bg-background sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b p-4">
          <h2 id="review-title" className="text-lg font-semibold">
            Revisar substituição
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {chosen.food.name} — {Math.round(chosen.quantityG)}g ·{' '}
            {Math.round(chosen.macros.kcal)} kcal
          </p>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {/* Refeição-alvo */}
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {targetMealName} (Ajustada)
            </h3>
            <ul className="mt-2 space-y-1">
              {targetMealAdjustments.itemAdjustments.map((adj) => (
                <li key={adj.itemId}>
                  <ItemDiffRow adj={adj} />
                </li>
              ))}
            </ul>
          </section>

          {/* B7: checkboxes por refeição futura. User pode desmarcar pra
              excluir aquela da compensação — engine re-roda sem ela e
              residualExcess cresce. Mostra TODAS as futuras candidatas,
              não só as que receberam adjustment. */}
          {futureMealsByMealId.size > 0 && (
            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Compensar em
              </h3>
              <div className="mt-2 space-y-3">
                {[...futureMealsByMealId.entries()].map(([mealId, meal]) => {
                  const isExcluded = excludedFutureMealIds.has(mealId)
                  const fma = futureMealsAdjustments.find(
                    (f) => f.mealId === mealId,
                  )
                  const changed =
                    fma?.itemAdjustments.filter(
                      (a) => a.adjustedQuantityG !== a.originalQuantityG,
                    ) ?? []
                  return (
                    <div key={mealId}>
                      <button
                        type="button"
                        onClick={() => onToggleExcludeFuture(mealId)}
                        disabled={submitting}
                        aria-pressed={!isExcluded}
                        className={
                          'flex w-full items-center gap-2 rounded-md p-1.5 text-left transition-colors ' +
                          (isExcluded
                            ? 'opacity-60 hover:bg-muted/40'
                            : 'hover:bg-muted/40')
                        }
                      >
                        <Checkbox checked={!isExcluded} />
                        <span className="text-sm font-medium">{meal.name}</span>
                      </button>
                      {!isExcluded && changed.length > 0 && (
                        <ul className="mt-1 space-y-1 pl-7">
                          {changed.map((adj) => (
                            <li key={adj.itemId}>
                              <ItemDiffRow adj={adj} />
                            </li>
                          ))}
                        </ul>
                      )}
                      {!isExcluded && changed.length === 0 && (
                        <p className="pl-7 text-xs italic text-muted-foreground">
                          (sem ajuste necessário)
                        </p>
                      )}
                      {isExcluded && (
                        <p className="pl-7 text-xs italic text-muted-foreground">
                          (não compensar — fica como planejado)
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Resumo do dia */}
          <section className="rounded-lg border bg-muted/30 p-3">
            <h3 className="text-xs font-medium">Resumo do dia</h3>
            <p className="mt-1 text-xs tabular-nums text-muted-foreground">
              kcal: {Math.round(result.newDayTotals.kcal)} /{' '}
              {Math.round(result.dayTargets.kcal)} ({kcalPct}%)
            </p>
            <p className="text-xs tabular-nums text-muted-foreground">
              proteína: {result.newDayTotals.protein.toFixed(0)}g /{' '}
              {result.dayTargets.protein.toFixed(0)}g ({proteinPct}%)
            </p>
          </section>

          {/* Warnings */}
          {warnings.proteinBelowFloor && (
            <WarningBox>
              Você ficará abaixo da meta de proteína ({proteinPct}%).
            </WarningBox>
          )}
          {warnings.calorieAboveCeiling && (
            <WarningBox>
              As calorias do dia ficarão acima da meta ({kcalPct}%).
            </WarningBox>
          )}
          {warnings.excessNotFullyAbsorbed && (
            <WarningBox>
              Não foi possível absorver todo o excesso. Considere reduzir a
              porção.
            </WarningBox>
          )}
        </div>

        <div className="space-y-2 border-t p-4">
          <Button
            type="button"
            className="w-full"
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Confirmando...
              </>
            ) : (
              'Confirmar substituição'
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── ItemDiffRow ────────────────────────────────────────────────────
// Renderiza 1 item ajustado em 3 modos:
//   - removido (adjusted=0): strikethrough vermelho + "removido"
//   - ajustado (qty mudou >0): "Xg → Yg"
//   - sem mudança: linha simples (raro mas defensivo)

function ItemDiffRow({ adj }: { adj: ItemAdjustment }) {
  const origQty = Math.round(adj.originalQuantityG)
  const newQty = Math.round(adj.adjustedQuantityG)

  if (newQty === 0) {
    // Removido
    return (
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate">{adj.food.name}</span>
        <span className="shrink-0 tabular-nums">
          <span className="text-red-500/70 line-through">{origQty}g</span>{' '}
          <span className="text-red-500 text-xs">removido</span>
        </span>
      </div>
    )
  }

  if (newQty !== origQty) {
    return (
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate">{adj.food.name}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          <span className="line-through">{origQty}g</span>{' '}
          <span className="text-foreground">→ {newQty}g</span>
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="truncate">{adj.food.name}</span>
      <span className="shrink-0 tabular-nums text-muted-foreground">
        {newQty}g
      </span>
    </div>
  )
}

// ─── WarningBox ─────────────────────────────────────────────────────
// Caixa amarela com ⚠ + texto. Match V1.

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <p>{children}</p>
    </div>
  )
}

// Checkbox visual manual — mesmo padrão do meal-commit-sheet. Sem
// dep de @radix-ui/react-checkbox. O pai (botão) controla aria-pressed,
// então o div é decorativo.
function Checkbox({ checked }: { checked: boolean }) {
  return (
    <div
      aria-hidden
      className={
        'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors ' +
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
          className="h-3 w-3"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </div>
  )
}

// Util pra caller derivar adjustments → MealAdjustment[] mantendo refs
// limpas (não usado interno, mas exportado pra simétria).
export function isItemRemoved(adj: ItemAdjustment): boolean {
  return Math.round(adj.adjustedQuantityG) === 0
}

void ({} as MealAdjustment) // pra TS não acusar import unused
