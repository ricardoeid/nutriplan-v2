import { Plus } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

import type { LogMealWithEntries } from '../lib/types'

import { EntryRow } from './entry-row'
import { LogRowMenu } from './log-row-menu'

interface MealCardProps {
  meal: LogMealWithEntries
  onDeleteEntry: (entryId: string) => void
  onDeleteMeal: (mealId: string, mealName: string) => void
  onAddFood: (mealId: string) => void
  deleteEntryPending: boolean
  deleteMealPending: boolean
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
// "Adicionar alimento" inline (não FAB) match V1. Em B5 o botão dispara
// toast "em breve"; B7 wires com AddFoodFlow.
//
// TODO Fase 5: quando meal.plan_meal_id != null, renderizar comparison
// "Esperado plano: X kcal · YP · ZC · WG" + "Comido agora: ..." com
// ícones target verdes/âmbar/vermelhos por macro.
export function MealCard({
  meal,
  onDeleteEntry,
  onDeleteMeal,
  onAddFood,
  deleteEntryPending,
  deleteMealPending,
}: MealCardProps) {
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
