// Tipos da feature `plans` (Fase 5).
//
// MealPlan é a forma mínima que /planos (lista) e /plano (today's view)
// precisam. Os outros tipos (PlanMealRow, PlanSlotRow, etc.) entram nos
// blocos B3-B4 quando construirmos o editor — não pré-definimos agora
// pra evitar tipos não-usados.
//
// PlanTree (resultado da RPC get_plan_tree) também vem no B3, quando
// soubermos o jsonb exato que o banco devolve.

export type MealPlan = {
  id: string
  user_id: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}
