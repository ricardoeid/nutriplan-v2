import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { FoodSearchBar } from '@/features/foods/components/food-search-bar'
import { useDebouncedValue } from '@/features/foods/hooks/use-debounced-value'
import { useFoodSearch } from '@/features/foods/hooks/use-food-search'
import type { FoodSearchResult } from '@/features/foods/lib/types'
import { FoodPickerRow } from '@/features/log/components/food-picker-row'

const DEBOUNCE_MS = 250

interface FoodPickerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (food: FoodSearchResult) => void
}

// Sheet enxuto pra escolher um food no editor de plano (B4).
//
// Diferença pra AddFoodSheet da Fase 4: aqui NÃO temos meal-picker
// nem qty step — só busca e click. A quantidade é setada depois, no
// ItemEditor, com UnitInput inline (cabe na linha do item, não precisa
// step inteiro pra isso).
//
// Padrão visual (§3 padrão 11 do STATUS):
//   - Mobile (< 640px): bottom-sheet com max-h-[90vh]
//   - Desktop (≥ 640px): modal centralizado max-w-md
//   - Esc fecha
//   - Body scroll-lock enquanto aberto
//   - Click no backdrop fecha (com stopPropagation no card)
//
// Reusos: FoodSearchBar, useFoodSearch, FoodPickerRow — toda a infra
// da Fase 3-4. Filter sempre 'all' nesse picker (B4 sem filter pills
// pra não poluir; se for útil depois, adiciono).
export function FoodPickerSheet({
  open,
  onOpenChange,
  onPick,
}: FoodPickerSheetProps) {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS)

  const { results, loading, fetching, error } = useFoodSearch({
    query: debouncedQuery,
    filter: 'all',
  })

  // Reset query quando reabre — evita que o user veja a busca anterior
  // ao adicionar item em outra option.
  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  // Esc fecha
  useEffect(() => {
    if (!open) return
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onOpenChange])

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

  const searchActive = query.trim().length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={() => onOpenChange(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="food-picker-title"
    >
      <div
        className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-xl bg-background p-4 sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="food-picker-title" className="text-lg font-semibold">
          Escolher alimento
        </h2>

        <FoodSearchBar
          value={query}
          onChange={setQuery}
          placeholder="Buscar alimento..."
          autoFocus
        />

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Erro ao buscar:{' '}
            {error instanceof Error ? error.message : 'desconhecido'}
          </p>
        )}

        {!searchActive && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Digite o nome do alimento.
          </p>
        )}

        {searchActive && loading && (
          <p className="flex items-center justify-center gap-2 py-4 text-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
          </p>
        )}

        {searchActive && !loading && results.length === 0 && (
          <p className="rounded-md border border-dashed border-border bg-card px-3 py-6 text-center text-sm text-muted-foreground">
            Nenhum alimento encontrado.
          </p>
        )}

        {searchActive && !loading && results.length > 0 && (
          <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
            {results.map((food) => (
              <FoodPickerRow
                key={food.id}
                food={food}
                onSelect={(f) => {
                  onPick(f)
                  onOpenChange(false)
                }}
              />
            ))}
          </ul>
        )}

        {searchActive && fetching && !loading && (
          <p className="text-center text-xs text-muted-foreground">
            atualizando...
          </p>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
