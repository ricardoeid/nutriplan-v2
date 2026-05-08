import { useState } from 'react'

import { useFoodSearch } from '../hooks/use-food-search'
import { useDebouncedValue } from '../hooks/use-debounced-value'
import { FoodSearchBar } from '../components/food-search-bar'
import { FoodResultsList } from '../components/food-results-list'

// Rota /foods — Bloco 2 da Fase 3.
// Entrega: search bar com debounce, skeleton de loading, badge de
// fonte por cor, layout mobile-first.
//
// Filtros (Todos/TACO/Produtos/...) entram em B3.
// Estrela clicável (favoritar) entra em B4.
const DEBOUNCE_MS = 250

export default function FoodsPage() {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS)
  const { results, loading, fetching, error } = useFoodSearch({
    query: debouncedQuery,
  })

  // hasQuery considera o query *atual* (não o debounced) pra evitar
  // piscar "digite um alimento" durante a digitação.
  const hasQuery = query.trim().length > 0

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Alimentos</h1>

      <FoodSearchBar value={query} onChange={setQuery} autoFocus />

      <FoodResultsList
        results={results}
        loading={loading}
        fetching={fetching}
        error={error}
        hasQuery={hasQuery}
      />
    </div>
  )
}
