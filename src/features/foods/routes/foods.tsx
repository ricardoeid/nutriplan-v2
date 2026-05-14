import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import { getTodayBR } from '@/lib/dates'
import { AddFoodSheet } from '@/features/log/components/add-food-sheet'
import { useAddEntry } from '@/features/log/hooks/use-add-entry'
import { useDailyLog } from '@/features/log/hooks/use-daily-log'

import { useFoodSearch } from '../hooks/use-food-search'
import { useDebouncedValue } from '../hooks/use-debounced-value'
import { useToggleFavorite } from '../hooks/use-toggle-favorite'
import { useToggleHide } from '../hooks/use-toggle-hide'
import { FoodSearchBar } from '../components/food-search-bar'
import { FoodFilterPills } from '../components/food-filter-pills'
import { FoodResultsList } from '../components/food-results-list'
import type { FoodSearchFilter, FoodSearchResult } from '../lib/types'

const DEBOUNCE_MS = 250

const VALID_FILTERS: ReadonlyArray<FoodSearchFilter> = [
  'all',
  'taco',
  'off',
  'mine',
  'favorites',
  'recent',
  'frequent',
]

function isValidFilter(value: string | null): value is FoodSearchFilter {
  return value !== null && VALID_FILTERS.includes(value as FoodSearchFilter)
}

export default function FoodsPage() {
  // Estado de busca em URL search params. Sobrevive a navegar pra detail
  // de um food e voltar (componente desmonta + monta = state local sumiria).
  // Bônus: F5 preserva a busca também.
  // `replace: true` no setSearchParams evita encher o histórico com 1 entrada
  // por keystroke — todas as edições da query/filter colapsam pra uma só
  // entrada que vira "voltar pra /foods sem filtro" quando user dá back.
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const filterParam = searchParams.get('f')
  const filter: FoodSearchFilter = isValidFilter(filterParam)
    ? filterParam
    : 'all'

  const setQuery = (v: string) => {
    const next = new URLSearchParams(searchParams)
    if (v) next.set('q', v)
    else next.delete('q')
    setSearchParams(next, { replace: true })
  }

  const setFilter = (f: FoodSearchFilter) => {
    const next = new URLSearchParams(searchParams)
    if (f !== 'all') next.set('f', f)
    else next.delete('f')
    setSearchParams(next, { replace: true })
  }

  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS)
  const { results, loading, fetching, error } = useFoodSearch({
    query: debouncedQuery,
    filter,
  })
  const toggleFavorite = useToggleFavorite()
  const toggleHide = useToggleHide()

  // B8: estado pra abrir AddFoodSheet com um food selecionado.
  // dateISO sempre = hoje BR — não tem date navigator em /foods,
  // logar daqui sempre vai pro diário de hoje. useDailyLog dispara
  // get_or_create_daily_log e devolve as 6 refeições padrão (ou as
  // do plano ativo). Esse fetch acontece sempre que /foods renderiza,
  // mesmo se o user nunca abrir o sheet — pequeno custo aceitável.
  const dateISO = getTodayBR()
  const { meals } = useDailyLog(dateISO)
  const addEntry = useAddEntry()
  const [addFoodOpen, setAddFoodOpen] = useState(false)
  const [foodToAdd, setFoodToAdd] = useState<FoodSearchResult | undefined>(
    undefined,
  )

  const searchActive = query.trim().length > 0 || filter !== 'all'

  const handleToggleFavorite = (food: FoodSearchResult) => {
    toggleFavorite.mutate({
      foodId: food.id,
      currentIsFavorite: food.is_favorite,
    })
  }

  // Ocultar food: aplica mutation + toast com botão Desfazer.
  // Toast Sonner aceita `action: { label, onClick }` que renderiza
  // um botão no toast — click reverte via mutation oposta.
  // Auto-dismiss em 5s (default Sonner) é apropriado pro undo.
  const handleHide = (food: FoodSearchResult) => {
    toggleHide.mutate(
      { foodId: food.id, currentIsHidden: false },
      {
        onSuccess: () => {
          toast.success(`"${food.name}" ocultado`, {
            duration: 5000,
            action: {
              label: 'Desfazer',
              onClick: () => {
                toggleHide.mutate({
                  foodId: food.id,
                  currentIsHidden: true,
                })
              },
            },
          })
        },
      },
    )
  }

  // B8: abre AddFoodSheet com o food já escolhido, sem meal pré-selecionada.
  // Sheet começa pela step de meal picker.
  const handleAddToLog = (food: FoodSearchResult) => {
    setFoodToAdd(food)
    setAddFoodOpen(true)
  }

  const handleAddFoodConfirm = (params: {
    mealId: string
    food: FoodSearchResult
    quantityG: number
  }) => {
    addEntry.mutate(
      {
        mealId: params.mealId,
        dateISO,
        food: {
          id: params.food.id,
          name: params.food.name,
          brand: params.food.brand,
          source: params.food.source,
          serving_label: params.food.serving_label,
          default_serving_g: params.food.default_serving_g,
          kcal_per_100g: params.food.kcal_per_100g,
          protein_per_100g: params.food.protein_per_100g,
          carb_per_100g: params.food.carb_per_100g,
          fat_per_100g: params.food.fat_per_100g,
        },
        quantityG: params.quantityG,
      },
      {
        onSuccess: () => {
          toast.success(`${params.food.name} adicionado ao diário`)
          setAddFoodOpen(false)
        },
        onError: (err) =>
          toast.error(
            err instanceof Error
              ? `Erro ao adicionar: ${err.message}`
              : 'Erro ao adicionar alimento.',
          ),
      },
    )
  }

  const pendingFavoriteFoodId =
    toggleFavorite.isPending && toggleFavorite.variables
      ? toggleFavorite.variables.foodId
      : null

  const pendingHideFoodId =
    toggleHide.isPending && toggleHide.variables
      ? toggleHide.variables.foodId
      : null

  return (
    <>
      <div className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
        <h1 className="text-2xl font-semibold">Alimentos</h1>

        <FoodSearchBar value={query} onChange={setQuery} autoFocus />

        <FoodFilterPills value={filter} onChange={setFilter} />

        <FoodResultsList
          results={results}
          loading={loading}
          fetching={fetching}
          error={error}
          searchActive={searchActive}
          onToggleFavorite={handleToggleFavorite}
          onHide={handleHide}
          onAdd={handleAddToLog}
          pendingFavoriteFoodId={pendingFavoriteFoodId}
          pendingHideFoodId={pendingHideFoodId}
        />
      </div>

      <Link
        to="/foods/new"
        aria-label="Criar alimento"
        className="fixed bottom-20 right-6 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        <Plus className="h-6 w-6" />
      </Link>

      <AddFoodSheet
        open={addFoodOpen}
        onOpenChange={setAddFoodOpen}
        meals={meals}
        preSelectedMealId={undefined}
        preSelectedFood={foodToAdd}
        onConfirm={handleAddFoodConfirm}
        submitting={addEntry.isPending}
      />
    </>
  )
}
