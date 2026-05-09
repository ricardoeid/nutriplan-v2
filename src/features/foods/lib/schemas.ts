import { z } from 'zod'

// Schema do form de criação/edição de custom food.
// Usa discriminated union em `mode` — quando user escolhe "Por porção"
// no radio, o form valida campos de porção; quando escolhe "Por 100g",
// valida campos de 100g. O hook de save converte tudo pra per-100g
// (formato canônico do banco) antes do INSERT.
//
// Convenção: nomes em camelCase no TS, mapeados pra snake_case do
// banco no momento do save (kcal_per_100g, default_serving_g, etc).
//
// IMPORTANTE: este schema NÃO usa `.transform()`. RHF v8 + zod v4
// + discriminated union interage mal com transforms — o tipo de
// input do form não bate com o resolver. Qualquer normalização
// (string vazia → null, etc) acontece no hook de save.

const baseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Informe o nome do alimento')
    .max(120, 'Nome muito longo (máx. 120 caracteres)'),
  brand: z
    .string()
    .trim()
    .max(80, 'Marca muito longa (máx. 80 caracteres)')
    .optional(),
  // Peso da porção padrão. Sempre obrigatório, em ambos os modos —
  // user precisa dizer "porção típica = X g" pra UI calcular total
  // ao logar. No modo "Por porção", esse mesmo peso é o usado pra
  // converter macros da porção pra per-100g.
  defaultServingG: z
    .number({ message: 'Informe o peso da porção' })
    .positive('Peso deve ser positivo')
    .max(5000, 'Peso muito alto (máx. 5000 g)'),
  servingLabel: z
    .string()
    .trim()
    .max(40, 'Rótulo muito longo (máx. 40 caracteres)')
    .optional(),
  recalcWholeUnitsOnly: z.boolean(),
})

// Validações numéricas dos macros — reusadas em ambos os modos.
const kcalSchema = z
  .number({ message: 'Informe as calorias' })
  .nonnegative('Calorias não podem ser negativas')
  .max(9999, 'Valor de calorias muito alto')

const macroGramsSchema = z
  .number({ message: 'Informe o valor' })
  .nonnegative('Valor não pode ser negativo')
  .max(9999, 'Valor muito alto')

const per100gSchema = baseSchema.extend({
  mode: z.literal('per100g'),
  kcalPer100g: kcalSchema,
  proteinPer100g: macroGramsSchema,
  carbPer100g: macroGramsSchema,
  fatPer100g: macroGramsSchema,
})

const perServingSchema = baseSchema.extend({
  mode: z.literal('perServing'),
  kcalPerServing: kcalSchema,
  proteinPerServing: macroGramsSchema,
  carbPerServing: macroGramsSchema,
  fatPerServing: macroGramsSchema,
})

export const customFoodSchema = z.discriminatedUnion('mode', [
  per100gSchema,
  perServingSchema,
])

// Tipo do FORM (input antes da validação). Usar `z.input` em vez de
// `z.infer` pra que campos `.optional()` fiquem mesmo opcionais —
// isso bate com o que RHF recebe dos <input>.
export type CustomFoodFormData = z.input<typeof customFoodSchema>

// Tipo dos DADOS PARSEADOS (output depois da validação). É o que o
// hook de save consome — todos os campos opcionais já foram resolvidos.
export type CustomFoodParsedData = z.output<typeof customFoodSchema>

export type FoodInputMode = CustomFoodFormData['mode']

// === Schema de EDIÇÃO ===
//
// Edit usa SEMPRE per-100g (sem dual-mode). Razão: o banco guarda
// canônico em per-100g e não dá pra reverter a multiplicação sem
// perder informação (ex: 30g→100g = factor 3.33; 33g→100g = factor 3.0;
// resultado per-100g pode ser idêntico mas serving original diferente).
// Editar partindo do canônico é mais previsível.

export const editFoodSchema = baseSchema.extend({
  kcalPer100g: kcalSchema,
  proteinPer100g: macroGramsSchema,
  carbPer100g: macroGramsSchema,
  fatPer100g: macroGramsSchema,
})

export type EditFoodFormData = z.input<typeof editFoodSchema>
export type EditFoodParsedData = z.output<typeof editFoodSchema>
