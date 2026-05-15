import { useEffect, useState } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { UnitInput } from '@/components/unit-input'
import { FoodSearchBar } from '@/features/foods/components/food-search-bar'
import { useDebouncedValue } from '@/features/foods/hooks/use-debounced-value'
import { useFoodSearch } from '@/features/foods/hooks/use-food-search'
import type { FoodSearchResult } from '@/features/foods/lib/types'
import { FoodPickerRow } from '@/features/log/components/food-picker-row'

const DEBOUNCE_MS = 250

interface SubstitutionFoodStepProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetMealName: string
  onProceed: (food: FoodSearchResult, quantityG: number) => void
}

// Step 1 do flow "Quero comer outra coisa" (Fase 6 B6):
// busca food novo + define qty em gramas + preview de macros + botão
// "Próximo" que envia (food, qty) pro flow controller chamar o engine.
//
// Adapta lógica do AddFoodQuantityStep (Fase 4) mas:
//   - SEM meal picker (target já definido pelo card que abriu o flow)
//   - SEM submit direto pro banco — só passa adiante pro review sheet
//   - "Próximo" em vez de "Adicionar"
//
// Padrão visual: sheet manual (§3 padrão 10 STATUS) — bottom em mobile,
// modal em desktop, esc fecha, body scroll-lock.
export function SubstitutionFoodStep({
  open,
  onOpenChange,
  targetMealName,
  onProceed,
}: SubstitutionFoodStepProps) {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS)
  const [selectedFood, setSelectedFood] = useState<FoodSearchResult | null>(
    null,
  )
  const [grams, setGrams] = useState<number | null>(null)

  // Reset quando reabre
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedFood(null)
      setGrams(null)
    }
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

  const { results, loading, fetching, error } = useFoodSearch({
    query: debouncedQuery,
    filter: 'all',
  })

  if (!open) return null

  const searchActive = query.trim().length > 0

  // ─── Sub-view 1: busca de food ──────────────────────────────────
  if (!selectedFood) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
        onClick={() => onOpenChange(false)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sub-food-title"
      >
        <div
          className="flex max-h-[90vh] w-full max-w-md flex-col rounded-t-xl bg-background sm:rounded-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="border-b p-4">
            <h2 id="sub-food-title" className="text-lg font-semibold">
              Quero comer outra coisa
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {targetMealName} — escolha um alimento e o app ajusta o resto.
            </p>
          </header>

          <div className="space-y-3 p-4">
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
          </div>

          {searchActive && !loading && results.length > 0 && (
            <ul className="flex-1 space-y-1 overflow-y-auto px-4 pb-4">
              {results.map((food) => (
                <FoodPickerRow
                  key={food.id}
                  food={food}
                  onSelect={(f) => {
                    setSelectedFood(f)
                    setGrams(Math.round(f.default_serving_g))
                  }}
                />
              ))}
            </ul>
          )}

          {searchActive && fetching && !loading && (
            <p className="px-4 pb-2 text-center text-xs text-muted-foreground">
              atualizando...
            </p>
          )}

          <div className="border-t p-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Sub-view 2: qty + macros preview ───────────────────────────
  const safeGrams = grams && grams > 0 ? grams : 0
  const factor = safeGrams / 100
  const kcal = selectedFood.kcal_per_100g * factor
  const protein = selectedFood.protein_per_100g * factor
  const carbs = selectedFood.carb_per_100g * factor
  const fat = selectedFood.fat_per_100g * factor

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={() => onOpenChange(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sub-qty-title"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-t-xl bg-background sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b p-4">
          <button
            type="button"
            onClick={() => setSelectedFood(null)}
            className="mb-2 flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Trocar alimento
          </button>
          <h2 id="sub-qty-title" className="text-lg font-semibold">
            Quanto?
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {targetMealName} — quantidade do alimento escolhido.
          </p>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-sm font-medium">{selectedFood.name}</p>
            {selectedFood.brand && (
              <p className="text-xs text-muted-foreground">
                {selectedFood.brand}
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Quantidade (g)
            </label>
            <UnitInput
              type="decimal"
              unit="g"
              value={grams}
              onCommit={(v) => {
                if (v === null) return
                const n = Number(String(v).replace(',', '.'))
                if (Number.isNaN(n) || n <= 0) return
                setGrams(n)
              }}
            />
          </div>

          <div className="rounded-md bg-muted/40 p-3 tabular-nums">
            <p className="text-xs font-medium text-muted-foreground">
              Preview
            </p>
            <p className="text-sm">
              {Math.round(kcal)} kcal · P {protein.toFixed(1)}g · C{' '}
              {carbs.toFixed(1)}g · G {fat.toFixed(1)}g
            </p>
          </div>
        </div>

        <div className="space-y-2 border-t p-4">
          <Button
            type="button"
            className="w-full"
            disabled={!grams || grams <= 0}
            onClick={() => {
              if (!grams || grams <= 0) return
              onProceed(selectedFood, grams)
            }}
          >
            Próximo
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}
