import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

import { planKeys } from '../lib/query-keys'
import {
  type ItemDraft,
  type ItemDraftFood,
  type MealDraft,
  type OptionDraft,
  type PlanEditorState,
  type PlanTreeResponse,
  type SlotDraft,
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
// Mutadores expostos:
//   Refeições (B3):
//     - setPlanName(name)
//     - addMeal() / removeMeal(id) / updateMeal(id, patch)
//   Slots/Options/Items (B4):
//     - addSlot(mealId) / removeSlot(slotId) / updateSlot(slotId, patch)
//     - addOption(slotId) / removeOption(optionId)
//     - addItem(optionId, food, quantityG) / removeItem(itemId) / updateItem(itemId, patch)
//
// Decisão: NÃO há moveMeal/moveSlot — auto-ordenar por target_time (meals)
// e ordem de adição (slots/options/items via sort_order incremental).
//
// Decisão: addSlot cria o slot já com 1 option vazia. Reduz fricção
// (slot sem option seria inválido no save). User vê "+ Adicionar item"
// direto na option, sem precisar clicar "+ Adicionar opção" primeiro.
//
// Padrão da invalidação: como o B3-B4 não têm save, não invalidamos cache.
// B5 vai chamar `queryClient.invalidateQueries({queryKey: planKeys.tree(id)})`
// após save bem-sucedido pra ressincronizar.
//
// Mutações deep-nested usam map imutável explicitamente (em vez de
// abstração tipo immer ou lodash.set) porque a árvore é pequena
// (refeições × slots × opções × items raramente passa de algumas dezenas
// de elementos no total) e mantém a inspeção do que está acontecendo
// trivial pra futuro Claude.
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

  // ─── Mutators: plano + refeições ─────────────────────────────────

  const setPlanName = useCallback((name: string) => {
    setDraft((d) => (d ? { ...d, planName: name } : d))
  }, [])

  const addMeal = useCallback(() => {
    setDraft((d) => {
      if (!d) return d
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

  // ─── Mutators: slots ─────────────────────────────────────────────

  const addSlot = useCallback((mealId: string) => {
    setDraft((d) => {
      if (!d) return d
      return {
        ...d,
        meals: d.meals.map((m) => {
          if (m.id !== mealId) return m
          const maxOrder = m.slots.reduce(
            (max, s) => (s.sort_order > max ? s.sort_order : max),
            -1,
          )
          const newSlot: SlotDraft = {
            id: makeDraftId(),
            label: null,
            sort_order: maxOrder + 1,
            // Slot novo já vem com 1 option vazia — slot sem option é
            // inválido no save (B5) e seria fricção fazer o user
            // clicar "+ Adicionar opção" sempre.
            options: [
              {
                id: makeDraftId(),
                sort_order: 0,
                items: [],
              },
            ],
          }
          return { ...m, slots: [...m.slots, newSlot] }
        }),
      }
    })
  }, [])

  const removeSlot = useCallback((slotId: string) => {
    setDraft((d) => {
      if (!d) return d
      return {
        ...d,
        meals: d.meals.map((m) => ({
          ...m,
          slots: m.slots.filter((s) => s.id !== slotId),
        })),
      }
    })
  }, [])

  const updateSlot = useCallback(
    (slotId: string, patch: Partial<Pick<SlotDraft, 'label'>>) => {
      setDraft((d) => {
        if (!d) return d
        return {
          ...d,
          meals: d.meals.map((m) => ({
            ...m,
            slots: m.slots.map((s) =>
              s.id === slotId ? { ...s, ...patch } : s,
            ),
          })),
        }
      })
    },
    [],
  )

  // ─── Mutators: options ───────────────────────────────────────────

  const addOption = useCallback((slotId: string) => {
    setDraft((d) => {
      if (!d) return d
      return {
        ...d,
        meals: d.meals.map((m) => ({
          ...m,
          slots: m.slots.map((s) => {
            if (s.id !== slotId) return s
            const maxOrder = s.options.reduce(
              (max, o) => (o.sort_order > max ? o.sort_order : max),
              -1,
            )
            const newOption: OptionDraft = {
              id: makeDraftId(),
              sort_order: maxOrder + 1,
              items: [],
            }
            return { ...s, options: [...s.options, newOption] }
          }),
        })),
      }
    })
  }, [])

  const removeOption = useCallback((optionId: string) => {
    setDraft((d) => {
      if (!d) return d
      return {
        ...d,
        meals: d.meals.map((m) => ({
          ...m,
          slots: m.slots.map((s) => ({
            ...s,
            options: s.options.filter((o) => o.id !== optionId),
          })),
        })),
      }
    })
  }, [])

  // ─── Mutators: items ─────────────────────────────────────────────

  const addItem = useCallback(
    (optionId: string, food: ItemDraftFood, quantityG: number) => {
      setDraft((d) => {
        if (!d) return d
        return {
          ...d,
          meals: d.meals.map((m) => ({
            ...m,
            slots: m.slots.map((s) => ({
              ...s,
              options: s.options.map((o) => {
                if (o.id !== optionId) return o
                const newItem: ItemDraft = {
                  id: makeDraftId(),
                  food_id: food.id,
                  quantity_g: quantityG,
                  food,
                }
                return { ...o, items: [...o.items, newItem] }
              }),
            })),
          })),
        }
      })
    },
    [],
  )

  const removeItem = useCallback((itemId: string) => {
    setDraft((d) => {
      if (!d) return d
      return {
        ...d,
        meals: d.meals.map((m) => ({
          ...m,
          slots: m.slots.map((s) => ({
            ...s,
            options: s.options.map((o) => ({
              ...o,
              items: o.items.filter((i) => i.id !== itemId),
            })),
          })),
        })),
      }
    })
  }, [])

  const updateItem = useCallback(
    (itemId: string, patch: Partial<Pick<ItemDraft, 'quantity_g'>>) => {
      setDraft((d) => {
        if (!d) return d
        return {
          ...d,
          meals: d.meals.map((m) => ({
            ...m,
            slots: m.slots.map((s) => ({
              ...s,
              options: s.options.map((o) => ({
                ...o,
                items: o.items.map((i) =>
                  i.id === itemId ? { ...i, ...patch } : i,
                ),
              })),
            })),
          })),
        }
      })
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
    addSlot,
    removeSlot,
    updateSlot,
    addOption,
    removeOption,
    addItem,
    removeItem,
    updateItem,
  }
}
