import { useState } from 'react'

import { useFoodSearch } from '../hooks/use-food-search'
import { useDebouncedValue } from '../hooks/use-debounced-value'
import { useToggleFavorite } from '../hooks/use-toggle-favorite'
import { FoodSearchBar } from '../components/food-search-bar'
import { FoodFilterPills } from '../components/food-filter-pills'
import { FoodResultsList } from '../components/food-results-list'
import type { FoodSearchFilter, FoodSearchResult } from '../lib/types'

// Rota /foods — Bloco 4 da Fase 3.
// Entrega: estrela clicável em cada row pra alternar is_favorite,
// com optimistic update e rollback em caso de erro.
const DEBOUNCE_MS = 250

export default function FoodsPage() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FoodSearchFilter>('all')
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS)
  const { results, loading, fetching, error } = useFoodSearch({
    query: debouncedQuery,
    filter,
  })
  const toggleFavorite = useToggleFavorite()

  // searchActive considera o query *atual* (não o debounced) e o filter
  // ativo. Lógica espelhada em use-food-search (`enabled`) — manter
  // sincronizado pra UI não piscar placeholder durante digitação.
  const searchActive = query.trim().length > 0 || filter !== 'all'

  const handleToggleFavorite = (food: FoodSearchResult) => {
    toggleFavorite.mutate({
      foodId: food.id,
      currentIsFavorite: food.is_favorite,
    })
  }

  // ID do food sendo mutado (pra desabilitar só a estrela dele).
  // TanStack expõe `variables` durante isPending — útil quando só
  // permitimos uma mutation por vez (caso atual: cada clique cria
  // uma mutation independente, mas só uma fica `pending` por vez
  // dado o tempo de RPC).
  const pendingFavoriteFoodId =
    toggleFavorite.isPending && toggleFavorite.variables
      ? toggleFavorite.variables.foodId
      : null

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
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
        pendingFavoriteFoodId={pendingFavoriteFoodId}
      />
    </div>
  )
}
