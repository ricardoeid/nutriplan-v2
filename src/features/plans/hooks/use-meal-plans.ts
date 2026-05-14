import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/hooks/useAuth'

import { planKeys } from '../lib/query-keys'
import type { MealPlan } from '../lib/types'

// Lista todos os planos do user atual, com o plano ativo SEMPRE em
// primeiro (is_active desc), e desempate por created_at desc (mais
// recente primeiro).
//
// Os dois .order() encadeados viram um ORDER BY composto no banco —
// ordenar server-side garante que ao ativar um plano (invalidate +
// re-fetch) ele já volta no topo, sem precisar sort no cliente.
//
// RLS filtra por user_id automaticamente — não precisamos passar no
// .eq(). `enabled: !!user` evita disparar enquanto auth ainda carrega.
//
// Retorno segue padrão amigável do projeto (regra 4 do §3 STATUS) —
// objeto com nomes claros, não o cru do TanStack Query.
export function useMealPlans() {
  const { user } = useAuth()
  const userId = user?.id

  const result = useQuery({
    queryKey: planKeys.list(),
    enabled: !!userId,
    queryFn: async (): Promise<MealPlan[]> => {
      const { data, error } = await supabase
        .from('meal_plans')
        .select('id, user_id, name, is_active, created_at, updated_at')
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as MealPlan[]
    },
  })

  return {
    plans: result.data ?? [],
    loading: result.isLoading,
    fetching: result.isFetching,
    error: result.error,
  }
}
