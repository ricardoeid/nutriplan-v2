import { Plus } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

import type { LogMealWithEntries } from '../lib/types'
import { getMacroTargetState, MacroTargetIcon } from '../lib/macro-target'

import { EntryRow } from './entry-row'
import { LogRowMenu } from './log-row-menu'

// Totais de macros pra uma refeição (esperado do plano OU consumido das
// entries). Mesmo shape pros 2 — facilita comparação no render.
export interface MealMacroTotals {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

interface MealCardProps {
  meal: LogMealWithEntries
  onDeleteEntry: (entryId: string) => void
  onDeleteMeal: (mealId: string, mealName: string) => void
  onAddFood: (mealId: string) => void
  deleteEntryPending: boolean
  deleteMealPending: boolean
  // Fase 6 B4: quando passado E meal.plan_meal_id != null, renderiza a
  // 2ª linha "Esperado plano · Comido agora" com ícones target por
  // macro. Pra dias passados, parent pode passar undefined (P24 futura)
  // — card volta a render só o header sem comparison.
  expectedTotals?: MealMacroTotals
}

// Card de uma refeição do diário. Match layout V1:
//   ┌──────────────────────────────────┐
//   │ Almoço  [Do plano]           ••• │
//   │ (Esperado/Comido — Fase 5)       │
//   │ ─────────────────────────────    │
//   │ Mamão papaia                  ••• │
//   │ 150g · 60 kcal                    │
//   │ ─────────────────────────────    │
//   │ + Adicionar alimento              │
//   └──────────────────────────────────┘
//
// IMPORTANTE — mutations de delete NÃO vivem aqui. Quando uma refeição
// é deletada com optimistic update, este componente desmonta antes da
// mutation completar; se as mutations estivessem aqui, os callbacks
// (onSuccess/onError) seriam droppados pelo TanStack Query v5 (observer
// removido com unmount). Resultado real disso: toast não aparece E
// rollback de erro não roda. Por isso o pai (HomePage) detém as
// mutations e passa handlers como props.
//
// Badge "Do plano" aparece quando log_meal foi seedada do plano ativo
// (plan_meal_id != null). Em Fase 4 nunca acontece — RPC seedou os 6
// defaults sem plan_meal_id.
//
// "Adicionar alimento" inline (não FAB) match V1.
//
// Fase 6 B4: quando expectedTotals + meal.plan_meal_id != null, renderiza
// "Esperado plano: X kcal · YP · ZC · WG" + "Comido agora: ..." com
// ícones target (verde/âmbar/vermelho/circle) por macro (ver lib/macro-target).
export function MealCard({
  meal,
  onDeleteEntry,
  onDeleteMeal,
  onAddFood,
  deleteEntryPending,
  deleteMealPending,
  expectedTotals,
}: MealCardProps) {
  // Comparison só faz sentido pra refeições do plano. Sem plan_meal_id
  // (refeições manuais via "Adicionar refeição"), pula a 2ª linha.
  const showComparison = !!meal.plan_meal_id && !!expectedTotals
  const consumedTotals = showComparison
    ? computeConsumedTotals(meal.entries)
    : null

  return (
    <Card>
      <CardContent className="px-0 pt-4 pb-0">
        <div className="flex items-center justify-between gap-2 px-4 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-semibold truncate">{meal.name}</h3>
            {meal.plan_meal_id && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                Do plano
              </span>
            )}
          </div>
          <LogRowMenu
            onDelete={() => onDeleteMeal(meal.id, meal.name)}
            deleteLabel="Excluir refeição"
            disabled={deleteMealPending}
          />
        </div>

        {showComparison && expectedTotals && consumedTotals && (
          <div className="space-y-0.5 px-4 pb-2 text-xs tabular-nums">
            <p className="text-muted-foreground">
              <span className="font-medium">Esperado plano:</span>{' '}
              {Math.round(expectedTotals.kcal)} kcal ·{' '}
              {expectedTotals.protein.toFixed(0)}P ·{' '}
              {expectedTotals.carbs.toFixed(0)}C ·{' '}
              {expectedTotals.fat.toFixed(0)}G
            </p>
            <p className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-muted-foreground">
              <span className="font-medium text-foreground">
                Comido agora:
              </span>
              <span className="inline-flex items-center gap-0.5">
                {Math.round(consumedTotals.kcal)} kcal
                <MacroTargetIcon
                  state={getMacroTargetState(
                    expectedTotals.kcal,
                    consumedTotals.kcal,
                  )}
                />
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-0.5">
                {consumedTotals.protein.toFixed(0)}P
                <MacroTargetIcon
                  state={getMacroTargetState(
                    expectedTotals.protein,
                    consumedTotals.protein,
                  )}
                />
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-0.5">
                {consumedTotals.carbs.toFixed(0)}C
                <MacroTargetIcon
                  state={getMacroTargetState(
                    expectedTotals.carbs,
                    consumedTotals.carbs,
                  )}
                />
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-0.5">
                {consumedTotals.fat.toFixed(0)}G
                <MacroTargetIcon
                  state={getMacroTargetState(
                    expectedTotals.fat,
                    consumedTotals.fat,
                  )}
                />
              </span>
            </p>
          </div>
        )}

        {meal.entries.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground border-t border-border">
            Nenhum alimento ainda.
          </p>
        ) : (
          <ul className="px-4 border-t border-border">
            {meal.entries.map((entry) => (
              <li key={entry.id}>
                <EntryRow
                  entry={entry}
                  onDelete={() => onDeleteEntry(entry.id)}
                  disabled={deleteEntryPending}
                />
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => onAddFood(meal.id)}
          className="w-full flex items-center justify-center gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" />
          Adicionar alimento
        </button>
      </CardContent>
    </Card>
  )
}

// Soma macros dos entries da refeição. Snapshot pattern (§4 STATUS):
// entry.kcal/protein/carbs/fat já estão computados — não recalcular do
// food.per_100g. Casts via Number defensivo (Supabase numeric → string
// às vezes).
function computeConsumedTotals(
  entries: LogMealWithEntries['entries'],
): MealMacroTotals {
  return entries.reduce<MealMacroTotals>(
    (acc, entry) => ({
      kcal: acc.kcal + Number(entry.kcal),
      protein: acc.protein + Number(entry.protein),
      carbs: acc.carbs + Number(entry.carbs),
      fat: acc.fat + Number(entry.fat),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
}
