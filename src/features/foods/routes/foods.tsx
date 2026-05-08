import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'

import { useFoodSearch } from '../hooks/use-food-search'
import { useDebouncedValue } from '../hooks/use-debounced-value'
import { useToggleFavorite } from '../hooks/use-toggle-favorite'
import { FoodSearchBar } from '../components/food-search-bar'
import { FoodFilterPills } from '../components/food-filter-pills'
import { FoodResultsList } from '../components/food-results-list'
import type { FoodSearchFilter, FoodSearchResult } from '../lib/types'

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

  const searchActive = query.trim().length > 0 || filter !== 'all'

  const handleToggleFavorite = (food: FoodSearchResult) => {
    toggleFavorite.mutate({
      foodId: food.id,
      currentIsFavorite: food.is_favorite,
    })
  }

  const pendingFavoriteFoodId =
    toggleFavorite.isPending && toggleFavorite.variables
      ? toggleFavorite.variables.foodId
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
          pendingFavoriteFoodId={pendingFavoriteFoodId}
        />
      </div>

      {/* FAB (Floating Action Button) — padrão mobile-first.
          fixed: fica colado no viewport, ignora scroll
          bottom-6 right-6: ~24px de cada borda
          z-10: acima da lista mas abaixo de eventuais modals
          shadow-lg: dá profundidade (parece flutuar)
          O `pb-24` no container acima previne que o FAB cubra o
          último resultado quando o user scrolla até o fim. */}
      <Link
        to="/foods/new"
        aria-label="Criar alimento"
        className="fixed bottom-6 right-6 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        <Plus className="h-6 w-6" />
      </Link>
    </>
  )
}
