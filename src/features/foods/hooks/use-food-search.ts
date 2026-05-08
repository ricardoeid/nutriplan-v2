import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/hooks/useAuth'

import { foodKeys } from '../lib/query-keys'
import type { FoodSearchFilter, FoodSearchResult } from '../lib/types'

interface UseFoodSearchParams {
  query: string
  filter?: FoodSearchFilter
  limit?: number
}

// Hook de busca de alimentos. Encapsula a chamada da RPC `search_foods`
// (ranking server-side, exclusão de hidden, gating de cached OFF).
//
// Comportamento:
//   - filter='all' + query vazia → não dispara a RPC (sem critério)
//   - filter !== 'all' → sempre dispara, mesmo com query vazia
//     (ex: clicar "Frequentes" sem digitar mostra os mais usados)
//   - p_user_id é REQUIRED na assinatura da RPC; pegamos via useAuth.
//     Se não tem user, query fica disabled (sem erro silencioso).
//
// Limit default 30 alinha com o default da RPC (`p_limit DEFAULT 30`).
//
// Retorno segue padrão dos outros hooks de query do projeto
// (useProfile etc.): nomes amigáveis, não o objeto cru do TanStack Query.
export function useFoodSearch(params: UseFoodSearchParams) {
  const { query, filter = 'all', limit = 30 } = params
  const { user } = useAuth()
  const userId = user?.id

  const trimmedQuery = query.trim()

  // `enabled` libera a query se há texto OU se um filtro foi escolhido.
  // Filtro != 'all' já é critério de seleção válido por si só.
  // 'all' sem query = sem critério → idle.
  // Cálculo espelhado em foods.tsx (`searchActive`); manter sincronizado.
  const enabled =
    !!userId && (trimmedQuery.length > 0 || filter !== 'all')

  const result = useQuery({
    queryKey: foodKeys.search({ query: trimmedQuery, filter, limit }),
    enabled,
    queryFn: async (): Promise<FoodSearchResult[]> => {
      if (!userId) throw new Error('No user')

      const { data, error } = await supabase.rpc('search_foods', {
        p_user_id: userId,
        p_query: trimmedQuery,
        p_filter: filter,
        p_limit: limit,
      })

      if (error) throw error

      // Cast intencional: o tipo gerado pelo Supabase declara campos
      // como `string`/`number` sem nullability, mas na prática vêm null.
      // FoodSearchResult (em ../lib/types) tipa honestamente.
      return (data ?? []) as unknown as FoodSearchResult[]
    },
  })

  return {
    results: result.data ?? [],
    loading: result.isLoading,
    fetching: result.isFetching, // true em refetches também
    error: result.error,
  }
}
