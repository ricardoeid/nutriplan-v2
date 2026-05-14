import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

import { planKeys } from '../lib/query-keys'
import {
  type MealDraft,
  type PlanEditorState,
  type PlanTreeResponse,
  makeDraftId,
  planTreeToEditorState,
} from '../lib/draft-types'

// Hook do editor de plano. Combina:
//   1. Fetch read-only via `useQuery` (cache TanStack) na RPC get_plan_tree
//   2. Estado local `draft` (useState) — mutações ficam só na memória do
//      navegador até o B5 implementar o save com diff FK-safe.
//
// Modelo mental: "lousa" — useQuery traz o original do banco, o useState
// guarda o rascunho. Reload da página descarta a lousa e re-busca o
// original.
//
// Mutadores que o B3 expõe:
//   - setPlanName(name)
//   - addMeal()                 → cria refeição com nome placeholder
//   - removeMeal(id)
//   - updateMeal(id, patch)     → patch parcial (name, target_time)
//
// Mutadores que ficam pro B4: addSlot, addOption, addItem, etc.
//
// Decisão: NÃO há moveMeal (auto-ordenar por target_time substitui isso —
// ver Fase 5 setup decisions).
//
// Padrão da invalidação: como o B3 não tem save, não invalidamos cache.
// B5 vai chamar `queryClient.invalidateQueries({queryKey: planKeys.tree(id)})`
// após save bem-sucedido pra ressincronizar.
export function usePlanEditor(planId: string) {
  const query = useQuery({
    queryKey: planKeys.tree(planId),
    enabled: !!planId,
    queryFn: async (): Promise<PlanTreeResponse | null> => {
      const { data, error } = await supabase.rpc('get_plan_tree', {
        p_plan_id: planId,
      })
      if (error) throw error
      // RPC retorna null quando plano não existe ou não é do user (RLS
      // via auth.uid() na própria query). Resultado vem como `Json`
      // genérico — cast pro tipo conhecido (Regra 13: sabemos o shape
      // porque inspecionamos com pg_get_functiondef).
      return (data ?? null) as unknown as PlanTreeResponse | null
    },
  })

  const [draft, setDraft] = useState<PlanEditorState | null>(null)

  // Quando o fetch completa, hidrata o draft. `draft === null` evita
  // sobrescrever edições do user se a query refetch (ex: window focus).
  useEffect(() => {
    if (query.data && draft === null) {
      setDraft(planTreeToEditorState(planId, query.data))
    }
  }, [query.data, draft, planId])

  // ─── Mutators ─────────────────────────────────────────────────────

  const setPlanName = useCallback((name: string) => {
    setDraft((d) => (d ? { ...d, planName: name } : d))
  }, [])

  const addMeal = useCallback(() => {
    setDraft((d) => {
      if (!d) return d
      // sort_order = max+1 entre as refeições atuais. Esse valor só
      // importa como tiebreaker — a ordenação visual usa target_time
      // (compareMealsByTime).
      const maxOrder = d.meals.reduce(
        (max, m) => (m.sort_order > max ? m.sort_order : max),
        -1,
      )
      const newMeal: MealDraft = {
        id: makeDraftId(),
        name: 'Nova refeição',
        target_time: null,
        sort_order: maxOrder + 1,
        slots: [],
      }
      return { ...d, meals: [...d.meals, newMeal] }
    })
  }, [])

  const removeMeal = useCallback((mealId: string) => {
    setDraft((d) =>
      d ? { ...d, meals: d.meals.filter((m) => m.id !== mealId) } : d,
    )
  }, [])

  const updateMeal = useCallback(
    (mealId: string, patch: Partial<Pick<MealDraft, 'name' | 'target_time'>>) => {
      setDraft((d) =>
        d
          ? {
              ...d,
              meals: d.meals.map((m) =>
                m.id === mealId ? { ...m, ...patch } : m,
              ),
            }
          : d,
      )
    },
    [],
  )

  return {
    draft,
    // Distinguir "carregando primeira vez" de "plano não existe":
    //   loading=true → spinner
    //   loading=false + draft===null + data===null → "não encontrado"
    //   loading=false + draft!==null → render normal
    loading: query.isLoading,
    error: query.error,
    notFound: !query.isLoading && !query.error && query.data === null,
    // Mutators
    setPlanName,
    addMeal,
    removeMeal,
    updateMeal,
  }
}
