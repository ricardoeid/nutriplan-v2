import { Loader2 } from 'lucide-react'

import { FoodRow } from './food-row'
import type { FoodSearchResult } from '../lib/types'

interface FoodResultsListProps {
  results: FoodSearchResult[]
  loading: boolean
  fetching: boolean
  // `error` vem como `unknown` porque é o tipo do TanStack Query e não
  // queremos forçar cast no parent. O componente normaliza pra string.
  error: unknown
  // True quando há query ou filtro aplicado (filter !== 'all'). Quando
  // false, mostra placeholder convidando o user a interagir.
  searchActive: boolean
  // Callback de favoritar — propagado pra cada FoodRow.
  onToggleFavorite: (food: FoodSearchResult) => void
  // ID do food com mutation pendente (pra desabilitar a estrela
  // específica). Null = nada pendente.
  pendingFavoriteFoodId: string | null
}

const SKELETON_COUNT = 5

function FoodRowSkeleton() {
  return (
    <li className="rounded-md border border-border bg-card px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-5 w-14 shrink-0 animate-pulse rounded-full bg-muted" />
      </div>
    </li>
  )
}

export function FoodResultsList({
  results,
  loading,
  fetching,
  error,
  searchActive,
  onToggleFavorite,
  pendingFavoriteFoodId,
}: FoodResultsListProps) {
  if (error) {
    const message =
      error instanceof Error ? error.message : 'desconhecido'
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        Erro ao buscar: {message}
      </p>
    )
  }

  if (!searchActive) {
    return (
      <p className="text-sm text-muted-foreground">
        Digite um alimento ou escolha um filtro acima.
      </p>
    )
  }

  if (loading) {
    return (
      <ul className="space-y-1">
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <FoodRowSkeleton key={i} />
        ))}
      </ul>
    )
  }

  if (results.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-card px-3 py-6 text-center text-sm text-muted-foreground">
        Nenhum alimento encontrado.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-1">
        {results.map((food) => (
          <FoodRow
            key={food.id}
            food={food}
            onToggleFavorite={onToggleFavorite}
            isFavoritePending={pendingFavoriteFoodId === food.id}
          />
        ))}
      </ul>
      <p className="flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
        <span>{results.length} resultado(s)</span>
        {fetching && (
          <>
            <span aria-hidden>·</span>
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            <span>atualizando...</span>
          </>
        )}
      </p>
    </div>
  )
}
