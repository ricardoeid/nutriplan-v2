import { useState } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { UnitInput } from '@/components/unit-input'
import { FoodSearchBar } from '@/features/foods/components/food-search-bar'
import { useDebouncedValue } from '@/features/foods/hooks/use-debounced-value'
import { useFoodSearch } from '@/features/foods/hooks/use-food-search'
import type { FoodSearchResult } from '@/features/foods/lib/types'

import { FoodPickerRow } from './food-picker-row'

interface AddFoodQuantityStepProps {
  mealName: string
  // True quando essa step é o ponto de entrada (B7 do MealCard) e o
  // "Voltar" deve cancelar tudo. False (B8 de /foods) significa que o
  // voltar leva ao meal-picker.
  isFirstStep: boolean
  onBack: () => void
  onCancel: () => void
  onConfirm: (food: FoodSearchResult, quantityG: number) => void
  submitting: boolean
}

const DEBOUNCE_MS = 250

// Step 2 do AddFoodFlow: busca o alimento + define a quantidade em
// gramas + mostra preview dos macros calculados. Quando confirma,
// dispara onConfirm que o pai usa pra chamar a mutation useAddEntry.
//
// Duas sub-views no mesmo step:
//   - Sem food selecionado: search bar + lista de resultados
//   - Com food selecionado: card do food + input gramas + preview +
//     botões "Trocar alimento" / "Adicionar"
//
// Por simplicidade no B7: só modo gramas. Quando o food tem serving_label
// (ex: "unidade" pra ovo) mostramos como hint "≈ X unidades", mas o
// input continua em gramas. Toggle de modo serving fica pra polish.
//
// `recalc_whole_units_only` (só ovos hoje) também ignorado no B7 —
// usuário pode digitar gramas frac. Validação cliente pra forçar
// inteiros é polish.
export function AddFoodQuantityStep({
  mealName,
  isFirstStep,
  onBack,
  onCancel,
  onConfirm,
  submitting,
}: AddFoodQuantityStepProps) {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS)
  const [selectedFood, setSelectedFood] = useState<FoodSearchResult | null>(
    null,
  )
  const [grams, setGrams] = useState<number | null>(null)

  const { results, loading, fetching, error } = useFoodSearch({
    query: debouncedQuery,
    filter: 'all',
  })

  const searchActive = query.trim().length > 0

  // === Sub-view: seleção de food ===
  if (!selectedFood) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label={isFirstStep ? 'Cancelar' : 'Voltar'}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <p className="text-sm text-muted-foreground truncate">
            Adicionando em <span className="font-medium text-foreground">{mealName}</span>
          </p>
        </div>

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
          <p className="text-sm text-muted-foreground py-4 text-center">
            Digite o nome do alimento.
          </p>
        )}

        {searchActive && loading && (
          <p className="text-sm text-muted-foreground py-4 text-center flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
          </p>
        )}

        {searchActive && !loading && results.length === 0 && (
          <p className="rounded-md border border-dashed border-border bg-card px-3 py-6 text-center text-sm text-muted-foreground">
            Nenhum alimento encontrado.
          </p>
        )}

        {searchActive && !loading && results.length > 0 && (
          <ul className="space-y-1 max-h-[50vh] overflow-y-auto">
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
          <p className="text-xs text-muted-foreground text-center">
            atualizando...
          </p>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  // === Sub-view: quantidade do food selecionado ===
  const factor = grams != null ? grams / 100 : 0
  const previewKcal = selectedFood.kcal_per_100g * factor
  const previewP = selectedFood.protein_per_100g * factor
  const previewC = selectedFood.carb_per_100g * factor
  const previewG = selectedFood.fat_per_100g * factor

  const canConfirm = grams !== null && grams > 0

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm(selectedFood, grams)
  }

  const servingHint =
    selectedFood.serving_label && selectedFood.default_serving_g > 0
      ? `1 ${selectedFood.serving_label} ≈ ${selectedFood.default_serving_g}g`
      : null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setSelectedFood(null)
            setGrams(null)
          }}
          className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Trocar alimento"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="text-sm text-muted-foreground truncate">
          Em <span className="font-medium text-foreground">{mealName}</span>
        </p>
      </div>

      <div className="rounded-md border border-border bg-card p-3 space-y-1">
        <p className="font-medium">{selectedFood.name}</p>
        {selectedFood.brand && (
          <p className="text-xs text-muted-foreground">{selectedFood.brand}</p>
        )}
        <p className="text-xs text-muted-foreground tabular-nums">
          {Math.round(selectedFood.kcal_per_100g)} kcal / 100g · P{' '}
          {selectedFood.protein_per_100g.toFixed(1)}g · C{' '}
          {selectedFood.carb_per_100g.toFixed(1)}g · G{' '}
          {selectedFood.fat_per_100g.toFixed(1)}g
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Quantidade</label>
        <UnitInput
          type="decimal"
          unit="g"
          value={grams}
          onCommit={(v) => {
            if (v === null) {
              setGrams(null)
              return
            }
            const n = Number(v.replace(',', '.'))
            if (Number.isNaN(n) || n < 0) return
            setGrams(n)
          }}
          autoFocus
          placeholder="Ex: 100"
        />
        {servingHint && (
          <p className="text-xs text-muted-foreground">{servingHint}</p>
        )}
      </div>

      <div className="rounded-md border border-border bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground mb-1">Será adicionado</p>
        <p className="text-sm tabular-nums">
          <span className="font-semibold">{Math.round(previewKcal)} kcal</span>
          {' · '}P {previewP.toFixed(1)}g · C {previewC.toFixed(1)}g · G{' '}
          {previewG.toFixed(1)}g
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm || submitting}
        >
          {submitting ? 'Adicionando...' : 'Adicionar'}
        </Button>
      </div>
    </div>
  )
}
