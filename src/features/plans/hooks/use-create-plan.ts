import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/hooks/useAuth'

import { planKeys } from '../lib/query-keys'
import type { MealPlan } from '../lib/types'

// Cria um plano vazio (só nome). is_active default no banco é false —
// user precisa ir em /planos e clicar "Ativar" pra ele virar o plano
// do dia. Isso evita o caso "criei sem querer e perdi o plano antigo".
//
// Retorna o MealPlan criado (com id real) — caller usa pra navegar
// pro editor (`/planos/:id/editar`) quando o B3 estiver pronto. Por
// enquanto B2 redireciona pra /planos.
//
// Sem optimistic: precisamos do id real do banco pra navegar. Operação
// é instantânea (1 INSERT, ~100-200ms), feedback de loading no botão
// resolve a UX.
export function useCreatePlan() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name }: { name: string }): Promise<MealPlan> => {
      const userId = user?.id
      if (!userId) throw new Error('No user')

      const { data, error } = await supabase
        .from('meal_plans')
        .insert({ user_id: userId, name })
        .select('id, user_id, name, is_active, created_at, updated_at')
        .single()
      if (error) throw error
      if (!data) throw new Error('Plano criado mas resposta vazia')
      return data as MealPlan
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planKeys.list() })
    },
  })
}
