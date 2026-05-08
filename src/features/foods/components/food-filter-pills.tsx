import { cn } from '@/lib/utils'

import type { FoodSearchFilter } from '../lib/types'

interface FoodFilterPillsProps {
  value: FoodSearchFilter
  onChange: (filter: FoodSearchFilter) => void
}

// Pares value→label da pill. Ordem segue do "mais geral" pro "mais
// pessoal", o que ajuda intuição do user.
//
// "Produtos" é o display de `'off'` (open_food_facts) — escolha do
// blueprint pra evitar acrônimo.
const FILTERS: { value: FoodSearchFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'taco', label: 'TACO' },
  { value: 'off', label: 'Produtos' },
  { value: 'frequent', label: 'Frequentes' },
  { value: 'recent', label: 'Recentes' },
  { value: 'favorites', label: 'Favoritos' },
  { value: 'mine', label: 'Meus' },
]

// Pills horizontais com scroll em mobile.
// `-mx-4 px-4`: estende o scroll até as bordas do container pai
// (que tem p-4) — o conteúdo desliza por trás do padding em vez de
// ser cortado por ele. Padrão comum em listas horizontais mobile.
export function FoodFilterPills({ value, onChange }: FoodFilterPillsProps) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <div className="flex w-max gap-2">
        {FILTERS.map((f) => {
          const isActive = f.value === value
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => onChange(f.value)}
              aria-pressed={isActive}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
