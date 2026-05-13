import { Card, CardContent } from '@/components/ui/card'

import type { DailyLog, DayTotals } from '../lib/types'

import { CalorieRing } from './calorie-ring'
import { MacroBar } from './macro-bar'

// Card de progresso diário, match layout V1:
//   [ring kcal]  [Proteína 79 / 162g  ━━━━━━━━]
//   [           [Carbo    108 / 368g  ━━━━━━━━]
//   [           [Gordura  23 / 79g    ━━━━━━━━]
//   ─────────────────────────────────────
//        Restante: 1857 kcal
//
// Targets vêm dos snapshots em `daily_logs` — preservam meta do dia mesmo
// se o profile mudar depois (regra do §4 do STATUS).

interface DailyProgressCardProps {
  totals: DayTotals
  dailyLog: DailyLog | undefined
}

const COLOR_PROTEIN = '#8B5CF6'
const COLOR_CARB = '#F59E0B'
const COLOR_FAT = '#EC4899'

export function DailyProgressCard({
  totals,
  dailyLog,
}: DailyProgressCardProps) {
  const kcalTarget = dailyLog?.calorie_target_snapshot ?? 0
  const proteinTarget = dailyLog?.protein_target_snapshot ?? 0
  const carbTarget = dailyLog?.carb_target_snapshot ?? 0
  const fatTarget = dailyLog?.fat_target_snapshot ?? 0

  // "Restante" = quanto falta pra atingir o target. Se já passou, mostra 0.
  // (V1 mostrava 0 também ao bater a meta — não vai negativo.)
  const remaining = Math.max(kcalTarget - totals.kcal, 0)

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-4">
          <CalorieRing consumed={totals.kcal} target={kcalTarget} />
          <div className="flex-1 space-y-3 min-w-0">
            <MacroBar
              label="Proteína"
              consumed={totals.protein}
              target={proteinTarget}
              color={COLOR_PROTEIN}
            />
            <MacroBar
              label="Carboidratos"
              consumed={totals.carbs}
              target={carbTarget}
              color={COLOR_CARB}
            />
            <MacroBar
              label="Gordura"
              consumed={totals.fat}
              target={fatTarget}
              color={COLOR_FAT}
            />
          </div>
        </div>
        <hr className="border-border" />
        <p className="text-center text-sm text-muted-foreground">
          Restante:{' '}
          <span className="font-semibold text-foreground tabular-nums">
            {Math.round(remaining)} kcal
          </span>
        </p>
      </CardContent>
    </Card>
  )
}
