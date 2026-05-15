import { Circle, Target, TrendingDown, TrendingUp } from 'lucide-react'

// Estado do ícone target por macro no MealCard da Home (Fase 6 B4) —
// e potencialmente em outros lugares que comparem "consumido vs
// esperado" (ex: DailyProgressCard no futuro).
//
// Decisão de produto (V1 + B4 spec):
//   - 'green'  → dentro de ±5% do esperado (ícone Target)
//   - 'amber'  → consumo > esperado × (1 + 5%) (ícone TrendingUp)
//   - 'red'    → consumo < esperado × (1 - 5%), > 0 (ícone TrendingDown)
//   - 'circle' → consumo = 0 (ícone Circle, neutro)
//
// Caso edge: esperado = 0 e consumido > 0 → 'amber' (qualquer
// consumo é "acima"). Refeição planejada sem proteína raramente
// existe na prática mas a função é defensiva.

export type MacroTargetState = 'green' | 'amber' | 'red' | 'circle'

export const MACRO_TARGET_TOLERANCE = 0.05

export function getMacroTargetState(
  expected: number,
  consumed: number,
): MacroTargetState {
  if (consumed === 0) return 'circle'
  if (expected === 0) return 'amber'

  const ratio = consumed / expected
  const lower = 1 - MACRO_TARGET_TOLERANCE
  const upper = 1 + MACRO_TARGET_TOLERANCE

  if (ratio >= lower && ratio <= upper) return 'green'
  if (ratio > upper) return 'amber'
  return 'red'
}

// Componente que renderiza o ícone do estado. Tamanho default 3.5
// (h-3.5 w-3.5) match com smallcaps inline na linha "Comido agora".
export function MacroTargetIcon({
  state,
  className,
}: {
  state: MacroTargetState
  className?: string
}) {
  const baseClass = className ?? 'h-3.5 w-3.5'
  switch (state) {
    case 'green':
      return <Target className={`${baseClass} text-green-500`} aria-hidden />
    case 'amber':
      return (
        <TrendingUp className={`${baseClass} text-amber-500`} aria-hidden />
      )
    case 'red':
      return (
        <TrendingDown className={`${baseClass} text-red-500`} aria-hidden />
      )
    case 'circle':
      return (
        <Circle className={`${baseClass} text-muted-foreground`} aria-hidden />
      )
  }
}
