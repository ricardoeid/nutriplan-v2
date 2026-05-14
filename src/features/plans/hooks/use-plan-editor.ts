import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

import { planKeys } from '../lib/query-keys'
import {
  type ItemDraftFood,
  type MealDraft,
  type PlanEditorState,
  type PlanTreeResponse,
  type SlotDraft,
  makeDraftId,
  makeOptionDraft,
  planTreeToEditorState,
} from '../lib/draft-types'

// Hook do editor de plano.
//
// Modelo conceitual da UI (Fase 5 — refactor inspirado em planos reais
// como o PDF de referência):
//   Refeição
//     └─ Alimento (slot)       label opcional ("FRUTAS", "PROTEÍNA")
//          ├─ Alternativa principal  (option sort_order=0)
//          │     • food + quantity_g
//          └─ Alternativas extras    (options sort_order>0)
//                • food + quantity_g
//
// Banco continua com 4 tabelas (plan_meals → plan_slots → slot_options
// → option_items). A UI esconde a tabela `option_items` forçando
// sempre 1 item por option. Helpers `getOptionFood`/`getOptionQty`
// em draft-types.ts abstraem o acesso.
//
// Mutators expostos:
//   Plano:        setPlanName(name)
//   Refeições:    addMeal() / removeMeal(id) / updateMeal(id, patch)
//   Alimentos:    addAlimento(mealId, food, qty)
//                 removeAlimento(slotId)
//                 updateAlimentoLabel(slotId, label)
//   Alternativas: addAlternativa(slotId, food, qty)
//                 removeAlternativa(optionId)
//                 updateAlternativaFood(optionId, food, qty)
//                 updateAlternativaQty(optionId, qty)
//
// Nota técnica: o tipo `OptionDraft.items` permanece como array por
// compat com schema do banco. UI sempre cria/mantém length=1. Planos
// antigos com 2+ items por option vão exibir só o primeiro.
export function usePlanEditor(planId: string) {
  const query = useQuery({
    queryKey: planKeys.tree(planId),
    enabled: !!planId,
    queryFn: async (): Promise<PlanTreeResponse | null> => {
      const { data, error } = await supabase.rpc('get_plan_tree', {
        p_plan_id: planId,
      })
      if (error) throw error
      return (data ?? null) as unknown as PlanTreeResponse | null
    },
  })

  const [draft, setDraft] = useState<PlanEditorState | null>(null)

  useEffect(() => {
    if (query.data && draft === null) {
      setDraft(planTreeToEditorState(planId, query.data))
    }
  }, [query.data, draft, planId])

  // ─── Plano + refeições ────────────────────────────────────────────

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
    (
      mealId: string,
      patch: Partial<Pick<MealDraft, 'name' | 'target_time'>>,
    ) => {
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

  // ─── Alimentos (slots) ────────────────────────────────────────────
  //
  // addAlimento cria o slot já com 1 alternativa principal (food +
  // qty fornecidos). Slot sem alternativa não faz sentido na UI —
  // user sempre escolhe um food pra começar.

  const addAlimento = useCallback(
    (mealId: string, food: ItemDraftFood, quantityG: number) => {
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
              options: [makeOptionDraft(food, quantityG, 0)],
            }
            return { ...m, slots: [...m.slots, newSlot] }
          }),
        }
      })
    },
    [],
  )

  const removeAlimento = useCallback((slotId: string) => {
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

  const updateAlimentoLabel = useCallback(
    (slotId: string, label: string | null) => {
      setDraft((d) => {
        if (!d) return d
        return {
          ...d,
          meals: d.meals.map((m) => ({
            ...m,
            slots: m.slots.map((s) =>
              s.id === slotId ? { ...s, label } : s,
            ),
          })),
        }
      })
    },
    [],
  )

  // ─── Alternativas (options) ───────────────────────────────────────

  const addAlternativa = useCallback(
    (slotId: string, food: ItemDraftFood, quantityG: number) => {
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
              return {
                ...s,
                options: [...s.options, makeOptionDraft(food, quantityG, maxOrder + 1)],
              }
            }),
          })),
        }
      })
    },
    [],
  )

  const removeAlternativa = useCallback((optionId: string) => {
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

  // Substitui o food da alternativa (mantém o id da option e do item
  // se possível — preserva refs do banco quando a alternativa já tinha
  // id real). Se a option ainda não tem item (caso edge de plano
  // antigo), cria um.
  const updateAlternativaFood = useCallback(
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
                const existing = o.items[0]
                const newItem = existing
                  ? { ...existing, food_id: food.id, quantity_g: quantityG, food }
                  : {
                      id: makeDraftId(),
                      food_id: food.id,
                      quantity_g: quantityG,
                      food,
                    }
                return { ...o, items: [newItem] }
              }),
            })),
          })),
        }
      })
    },
    [],
  )

  const updateAlternativaQty = useCallback(
    (optionId: string, quantityG: number) => {
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
                const existing = o.items[0]
                if (!existing) return o // sem food, nada pra atualizar
                return {
                  ...o,
                  items: [{ ...existing, quantity_g: quantityG }],
                }
              }),
            })),
          })),
        }
      })
    },
    [],
  )

  const resetDraft = useCallback(() => {
    setDraft(null)
  }, [])

  return {
    draft,
    original: query.data ?? null,
    loading: query.isLoading,
    error: query.error,
    notFound: !query.isLoading && !query.error && query.data === null,
    // Plano + refeições
    setPlanName,
    addMeal,
    removeMeal,
    updateMeal,
    // Alimentos
    addAlimento,
    removeAlimento,
    updateAlimentoLabel,
    // Alternativas
    addAlternativa,
    removeAlternativa,
    updateAlternativaFood,
    updateAlternativaQty,
    // Reset (após save)
    resetDraft,
  }
}
