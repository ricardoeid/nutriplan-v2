// Tipos compartilhados da feature `foods`. Mantidos isolados pra evitar
// import cíclico entre hooks/componentes/rotas.
//
// `FoodSource` espelha o CHECK constraint de `foods.source` no Postgres.
// O Supabase não gera enum tipado pra CHECK constraints (só pra ENUM
// types reais), então mantemos o union manualmente sincronizado.

export type FoodSource = 'taco' | 'open_food_facts' | 'custom' | 'composite'

// Filtros da rota /foods. Mapeiam pro argumento `p_filter` da RPC
// `search_foods`. Os valores exatos aceitos pela RPC ainda não foram
// confirmados no SQL — o B1 só usa 'all' (que é equivalente a não passar
// p_filter); B3 vai validar empiricamente os outros e ajustar se preciso.
export type FoodSearchFilter =
  | 'all' // sem filtro — passa undefined pro p_filter
  | 'taco'
  | 'products' // open_food_facts
  | 'mine' // custom + composite do user
  | 'favorites' // is_favorite=true
  | 'recent' // ordenado por last_used desc
  | 'frequent' // ordenado por use_count desc

// Resultado de uma row de `search_foods`. NÃO usa o tipo gerado pelo
// Supabase (`Database['public']['Functions']['search_foods']['Returns']`)
// porque ele declara campos como `string`/`number` sem nullability,
// quando na verdade o banco retorna NULL em brand, category, external_id,
// last_used e serving_label. Tipagem manual evita surpresa runtime.
export interface FoodSearchResult {
  id: string
  name: string
  source: FoodSource | string // string fallback caso surja source novo
  brand: string | null
  category: string | null
  external_id: string | null
  serving_label: string | null
  default_serving_g: number
  kcal_per_100g: number
  protein_per_100g: number
  carb_per_100g: number
  fat_per_100g: number
  fiber_per_100g: number | null
  recalc_whole_units_only: boolean
  is_composite: boolean
  is_favorite: boolean
  use_count: number
  last_used: string | null // ISO timestamp ou null se nunca usou
  rank_score: number
}
