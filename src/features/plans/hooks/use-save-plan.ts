import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

import { planKeys } from '../lib/query-keys'
import {
  executeSave,
  validateAndComputeDiff,
} from '../lib/diff'
import type { PlanEditorState, PlanTreeResponse } from '../lib/draft-types'

interface SavePlanVars {
  planId: string
  original: PlanTreeResponse
  draft: PlanEditorState
}

// Mutation que salva o plano. Sequência:
//   1. validateAndComputeDiff(original, draft) — joga PlanValidationError
//      se há slot/opção vazia ou nome inválido.
//   2. executeSave(supabase, planId, diff) — executa INSERTs/UPDATEs/
//      DELETEs no banco em ordem FK-safe.
//   3. Invalida + AWAIT refetch do tree → garante que a query.data
//      está fresca antes do plan-edit chamar resetDraft.
//   4. Invalida lista de planos (caso name tenha mudado).
//
// Caller (plan-edit.tsx) é responsável por:
//   - Mostrar toast amigável de PlanValidationError vs outros erros
//   - Chamar resetDraft() no useSavePlan.onSuccess (após este onSuccess)
//   - Chamar activate_meal_plan se plano é ativo (ressync diário hoje)
//
// Mutation no parent (plan-edit.tsx) — não há optimistic delete-self,
// mas mantemos o padrão de Regra 14 por consistência da feature.
export function useSavePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ planId, original, draft }: SavePlanVars) => {
      // validateAndComputeDiff joga PlanValidationError em caso de
      // problemas — bubble up pro caller tratar.
      const diff = validateAndComputeDiff(original, draft)
      await executeSave(supabase, planId, diff)
    },
    onSuccess: async (_data, vars) => {
      // Await refetch garante que o useEffect do usePlanEditor pega
      // a versão nova antes do plan-edit chamar resetDraft.
      await queryClient.refetchQueries({
        queryKey: planKeys.tree(vars.planId),
      })
      // Lista pode ter mudado o nome de algum plano — invalida pra
      // refletir no /planos.
      queryClient.invalidateQueries({ queryKey: planKeys.list() })
    },
  })
}
