// Barra horizontal de progresso de um macro (proteína / carbo / gordura).
// Cores fixas pela convenção do blueprint Parte 5:
//   Proteína: #8B5CF6 (violet-500)
//   Carbos:   #F59E0B (amber-500)
//   Gordura:  #EC4899 (pink-500)
//
// O preenchimento da barra é clamped a 100% — quando consumido > target,
// a barra fica cheia mas os números mostram o estouro real.

interface MacroBarProps {
  label: string
  consumed: number
  target: number
  color: string
}

export function MacroBar({ label, consumed, target, color }: MacroBarProps) {
  const safeTarget = target > 0 ? target : 0
  const pct =
    safeTarget > 0 ? Math.min(consumed / safeTarget, 1) : 0

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-baseline text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          <span className="font-medium text-foreground">
            {Math.round(consumed)}
          </span>
          <span className="text-muted-foreground">
            {' / '}
            {Math.round(safeTarget)}g
          </span>
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct * 100}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
