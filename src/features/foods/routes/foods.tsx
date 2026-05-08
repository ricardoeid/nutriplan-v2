import { useState } from 'react'

import { useFoodSearch } from '../hooks/use-food-search'
import { useDebouncedValue } from '../hooks/use-debounced-value'
import { FoodSearchBar } from '../components/food-search-bar'
import { FoodFilterPills } from '../components/food-filter-pills'
import { FoodResultsList } from '../components/food-results-list'
import type { FoodSearchFilter } from '../lib/types'

// Rota /foods — Bloco 3 da Fase 3.
// Entrega: filtros pills (Todos/TACO/Produtos/Frequentes/Recentes/
// Favoritos/Meus). Filtros funcionam mesmo com query vazia (a RPC
// search_foods aceita `p_query=''`), então o user pode clicar
// "Frequentes" e ver os mais usados sem digitar nada.
//
// Estrela clicável (favoritar) entra em B4.
const DEBOUNCE_MS = 250

export default function FoodsPage() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FoodSearchFilter>('all')
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS)
  const { results, loading, fetching, error } = useFoodSearch({
    query: debouncedQuery,
    filter,
  })

  // searchActive considera o query *atual* (não o debounced) e o filter
  // ativo. Lógica espelhada em use-food-search (`enabled`) — manter
  // sincronizado pra UI não piscar placeholder durante digitação.
  const searchActive = query.trim().length > 0 || filter !== 'all'

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
      />
    </div>
  )
}
