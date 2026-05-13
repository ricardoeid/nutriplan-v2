import type { LogEntryWithFood } from '../lib/types'

import { LogRowMenu } from './log-row-menu'

interface EntryRowProps {
  entry: LogEntryWithFood
  onDelete: () => void
  disabled?: boolean
}

// Mostra inteiro quando faz sentido (100, 50, 25), com 1 decimal se tem
// fração. Match V1: "150g" não "150.0g", mas "12.5g" preserva precisão.
function formatGrams(g: number): string {
  return g % 1 === 0 ? String(g) : g.toFixed(1)
}

// Uma linha de log_entry dentro de um MealCard.
// Layout V1:
//   Mamão papaia
//   150g · 60 kcal           •••
//
// Defensivo: se entry.food == null (food deletado ou FK quebrada), mostra
// "Alimento removido" em vez de crashar. Não deve acontecer com FK
// constraint no banco, mas defesa cheap.
export function EntryRow({ entry, onDelete, disabled }: EntryRowProps) {
  const foodName = entry.food?.name ?? 'Alimento removido'

  return (
    <div className="flex items-start justify-between gap-2 py-2 border-b border-border last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{foodName}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatGrams(entry.quantity_g)}g · {Math.round(entry.kcal)} kcal
        </p>
      </div>
      <LogRowMenu onDelete={onDelete} disabled={disabled} />
    </div>
  )
}
