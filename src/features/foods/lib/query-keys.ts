import type { FoodSearchFilter } from './types'

// Query keys da feature `foods`. Centralizadas pra invalidação fácil:
//
//   queryClient.invalidateQueries({ queryKey: foodKeys.all })
//     → derruba TUDO da feature (busca + futuras queries)
//
//   queryClient.invalidateQueries({ queryKey: ['foods', 'search'] })
//     → derruba só as buscas (todas as combinações de query/filter/limit)
//
// Em fases futuras, adicionar `detail(id)`, `myFoods()`, etc.
export const foodKeys = {
  all: ['foods'] as const,
  search: (params: {
    query: string
    filter: FoodSearchFilter
    limit: number
  }) => ['foods', 'search', params] as const,
}
