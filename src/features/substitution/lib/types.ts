// Tipos compartilhados do motor de substituição (Fase 6 B5).
//
// Engine é puro (sem I/O) — recebe dados estruturados, retorna dados.
// Caller (B6 — SubstitutionReviewSheet) é responsável por:
//   - montar SubstitutionInput a partir do plan tree + adjustments + dailyLog
//   - traduzir SubstitutionResult em UI (strikethrough, warnings, sheets)
//   - persistir via RPC atômica (P22 unificada) quando user confirmar
//
// Estruturas refletem o que o engine precisa, não o schema do banco — o
// caller faz o mapping. Isso desacopla o engine de mudanças no schema
// futuro.

export interface Macros {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export interface SubstitutionFood {
  id: string
  name: string
  brand: string | null
  source: string
  kcal_per_100g: number
  protein_per_100g: number
  carb_per_100g: number
  fat_per_100g: number
  default_serving_g: number
  // Quando true (ex: ovos), qty ajustada é arredondada pra múltiplo
  // inteiro de default_serving_g (engine não emite 1.5 ovo — emite 1 ou 2).
  recalc_whole_units_only: boolean
}

// Um item no plano (uma alternativa ATIVA de um slot — caller resolve o
// overlay com plan_day_adjustments antes de chamar o engine).
export interface SubstitutionItem {
  // Identificador estável pra mapear de volta no caller. Pode ser
  // option_item_id, slot_id, ou qualquer string única dentro da refeição.
  id: string
  food: SubstitutionFood
  quantity_g: number
}

export interface SubstitutionMeal {
  // plan_meal_id (caller usa pra escrever em plan_day_adjustments depois).
  id: string
  name: string
  // 'HH:MM' ou 'HH:MM:SS'; pra ordenar futuras se necessário no caller.
  // Engine não re-ordena — recebe futureMeals já em ordem desejada.
  target_time: string | null
  items: SubstitutionItem[]
}

// O food novo escolhido pelo user em "Quero comer outra coisa".
export interface SubstitutionChoice {
  food: SubstitutionFood
  quantity_g: number
}

// Contexto do dia. consumedSoFar é o que o user já comeu HOJE em
// refeições que NÃO são a target nem futuras (= refeições já comidas
// antes, ou refeições manuais via Home, etc.). Engine usa pra warnings.
//
// dayTargets vem de daily_logs.*_target_snapshot.
export interface SubstitutionDayContext {
  consumedSoFar: Macros
  dayTargets: Macros
}

export interface SubstitutionInput {
  targetMeal: SubstitutionMeal
  // Refeições futuras (target_time > target.target_time AND sem entries
  // ainda hoje). Caller filtra. Pode ser vazio (caso "última refeição
  // do dia") — engine lida com isso.
  futureMeals: SubstitutionMeal[]
  chosen: SubstitutionChoice
  day: SubstitutionDayContext
  // Opcional — set de meal ids que o user EXCLUIU da compensação (B7).
  // Default = vazio = todas as futuras são candidatas a absorver excess.
  // Refeições excluídas ficam com qty original (sem adjustments) e o
  // share que iria pra elas vira parte de residualExcess. UX:
  // checkboxes no review sheet permitem user marcar/desmarcar.
  excludedFutureMealIds?: Set<string>
}

export type PreservationStrategy =
  | 'preserve-protein'
  | 'neutral'
  | 'reduce-protein'

// Ajuste de UM item dentro de uma refeição.
//   - originalQuantityG === adjustedQuantityG → sem mudança (não mexer)
//   - adjustedQuantityG === 0                 → "removido" (strikethrough)
//   - originalQuantityG !== adjustedQuantityG → "ajustado" (Xg → Yg)
export interface ItemAdjustment {
  itemId: string
  food: SubstitutionFood
  originalQuantityG: number
  adjustedQuantityG: number
}

export interface MealAdjustment {
  mealId: string
  itemAdjustments: ItemAdjustment[]
}

export interface SubstitutionWarnings {
  // Total do dia (consumido + ajustes finais) < dayTargets.protein × 0.9
  proteinBelowFloor: boolean
  // Total do dia > dayTargets.kcal × 1.1
  calorieAboveCeiling: boolean
  // Após distribuir excess pelas futuras, ainda sobrou > 50 kcal AND
  // total dia > target × 1.02. Sinaliza "esse desvio não tem como
  // absorver no dia".
  excessNotFullyAbsorbed: boolean
}

export interface SubstitutionResult {
  // Refeição-alvo: items existentes com qty ajustada (alguns podem
  // ficar com adjustedQuantityG = 0 = "removido").
  targetMealAdjustments: MealAdjustment
  // Futuras afetadas pela propagação. Vazio se chosen coube na target
  // (excess = 0) ou se não há futuras.
  futureMealsAdjustments: MealAdjustment[]
  // O food novo escolhido. Caller usa pra inserir entry off-plan na
  // refeição-alvo + criar adjustments pro plan_day_adjustments.
  chosen: {
    food: SubstitutionFood
    quantityG: number
    macros: Macros
  }
  // Totais finais do dia se confirmar: consumedSoFar + target ajustada
  // + chosen + futuras ajustadas.
  newDayTotals: Macros
  dayTargets: Macros
  // Pcts pra "Resumo do dia" do print V1 (ex: 116%, 72%).
  kcalPctOfTarget: number
  proteinPctOfTarget: number
  preservationStrategy: PreservationStrategy
  // Excesso de kcal que NÃO foi absorvido nem pela target nem pelas
  // futuras. Alimenta o warning excessNotFullyAbsorbed.
  residualExcessKcal: number
  warnings: SubstitutionWarnings
}
