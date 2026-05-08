// Tipos compartilhados da feature `foods`. Mantidos isolados pra evitar
// import cíclico entre hooks/componentes/rotas.
//
// `FoodSource` espelha o CHECK constraint de `foods.source` no Postgres.
// O Supabase não gera enum tipado pra CHECK constraints (só pra ENUM
// types reais), então mantemos o union manualmente sincronizado.

export type FoodSource = 'taco' | 'open_food_facts' | 'custom' | 'composite'

// Filtros mapeados pro argumento `p_filter` da RPC `search_foods`.
// Valores literais confirmados em `pg_get_functiondef('search_foods')`:
//
//   'all'       → tudo do "mundo" do user (TACO + custom + composite +
//                 OFFs já usados pelo próprio user). EXCLUI OFFs
//                 cacheados por outros users que o user nunca tocou.
//   'taco'      → só source='taco'
//   'off'       → só source='open_food_facts' (display: "Produtos")
//   'mine'      → só foods criadas pelo user (custom + composite)
//   'favorites' → user_food_prefs.is_favorite = true
//   'recent'    → user_food_prefs.last_used IS NOT NULL
//   'frequent'  → user_food_prefs.use_count > 0
//
// Comportamento com query vazia: a RPC suporta `p_query = ''` — todos
// os filtros (exceto 'all') retornam resultados sem texto. 'all' sem
// query não tem critério nenhum, então o parent trata como idle.
export type FoodSearchFilter =
  | 'all'
  | 'taco'
  | 'off'
  | 'mine'
  | 'favorites'
  | 'recent'
  | 'frequent'

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
