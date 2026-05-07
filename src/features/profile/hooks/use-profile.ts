import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/hooks/useAuth'

// Hook compartilhado pra ler o profile do user atual. Cache do
// TanStack Query evita re-fetch a cada montagem. Quando o profile
// muda (ex: terminar onboarding, editar /profile), basta invalidar
// a query: queryClient.invalidateQueries({ queryKey: ['profile', userId] }).
export function useProfile() {
  const { user } = useAuth()
  const userId = user?.id

  const query = useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) throw new Error('No user')
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) throw error
      return data
    },
  })

  return {
    profile: query.data ?? null,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
