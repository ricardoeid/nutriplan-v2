import { useState } from 'react'

import { useFoodSearch } from '../hooks/use-food-search'

// Rota /foods — versão mínima do Bloco 1 da Fase 3.
// Objetivo: validar que `useFoodSearch` chama a RPC `search_foods` e
// retorna resultados reais do banco. UI sem styling sofisticado nem
// debounce — isso é B2. Filtros e favoritar são B3/B4.
export default function FoodsPage() {
  const [query, setQuery] = useState('')
  const { results, loading, fetching, error } = useFoodSearch({ query })

  const trimmed = query.trim()
  const showEmpty = trimmed.length > 0 && !loading && results.length === 0

  return (
    <div className="mx-auto max-w-2xl p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Alimentos</h1>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar alimento..."
        autoFocus
        className="w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />

      {error && (
        <p className="text-sm text-destructive">
          Erro ao buscar:{' '}
          {error instanceof Error ? error.message : 'desconhecido'}
        </p>
      )}

      {!trimmed && (
        <p className="text-sm text-muted-foreground">
          Digite um alimento pra buscar.
        </p>
      )}

      {trimmed && loading && (
        <p className="text-sm text-muted-foreground">Buscando...</p>
      )}

      {showEmpty && (
        <p className="text-sm text-muted-foreground">
          Nenhum alimento encontrado.
        </p>
      )}

      {results.length > 0 && (
        <ul className="space-y-1">
          {results.map((food) => (
            <li
              key={food.id}
              className="rounded border border-border bg-card px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{food.name}</span>
                {food.is_favorite && <span aria-label="Favorito">⭐</span>}
              </div>
              <div className="text-xs text-muted-foreground">
                <span className="uppercase">{food.source}</span>
                {' · '}
                {Math.round(food.kcal_per_100g)} kcal/100g
                {' · P '}
                {food.protein_per_100g}g{' · C '}
                {food.carb_per_100g}g{' · G '}
                {food.fat_per_100g}g
              </div>
            </li>
          ))}
        </ul>
      )}

      {results.length > 0 && (
        <p className="border-t pt-3 text-xs text-muted-foreground">
          {results.length} resultado(s)
          {fetching && ' · atualizando...'}
        </p>
      )}
    </div>
  )
}
