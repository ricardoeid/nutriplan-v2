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
//   - query vazia (após trim) → não dispara a RPC, retorna [] e
//     loading=false. Evita flood de "todos os alimentos" no input.
//   - filter='all' → não envia p_filter pra RPC (deixa banco aplicar
//     default). Garante que 'all' seja sempre o estado neutro
//     independente do que a RPC trate como string vazia / 'all' / null.
//   - p_user_id é REQUIRED na assinatura da RPC; pegamos via useAuth.
//     Se não tem user, query fica disabled (sem erro silencioso).
//
// Retorno segue padrão dos outros hooks de query do projeto
// (useProfile etc.): nomes amigáveis, não o objeto cru do TanStack Query.
export function useFoodSearch(params: UseFoodSearchParams) {
  const { query, filter = 'all', limit = 50 } = params
  const { user } = useAuth()
  const userId = user?.id

  const trimmedQuery = query.trim()
  const enabled = !!userId && trimmedQuery.length > 0

  const result = useQuery({
    queryKey: foodKeys.search({ query: trimmedQuery, filter, limit }),
    enabled,
    queryFn: async (): Promise<FoodSearchResult[]> => {
      if (!userId) throw new Error('No user')

      const { data, error } = await supabase.rpc('search_foods', {
        p_user_id: userId,
        p_query: trimmedQuery,
        p_limit: limit,
        // 'all' = estado neutro, não passa p_filter
        ...(filter !== 'all' && { p_filter: filter }),
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
