// Ring de calorias do diário. SVG manual (sem dependência de chart lib)
// pra economizar bundle (já em 700KB com warning) e ter controle total.
//
// Layout: anel circular começando às 12h, preenchimento horário (clockwise).
// Cor do arco depende de % consumido vs target, conforme convenção do
// blueprint Parte 5:
//   < 95%       → azul   (#3B82F6) — abaixo do target
//   95-105%     → verde  (#22C55E) — dentro de ±5%
//   105-115%    → âmbar  (#F59E0B) — 5-15% acima
//   > 115%      → vermelho (#EF4444) — mais que 15% acima
//
// Quando pct > 100%, o arco visual fica em 100% (cheio) mas a cor reflete
// o estouro real. Texto central mostra valor absoluto sem cap.

interface CalorieRingProps {
  consumed: number
  target: number
}

const RING_BG = '#E5E7EB' // gray-200; match light theme

function getCalorieColor(pct: number): string {
  if (pct > 1.15) return '#EF4444'
  if (pct > 1.05) return '#F59E0B'
  if (pct >= 0.95) return '#22C55E'
  return '#3B82F6'
}

// Path SVG de um arco começando em 12h (top), varrendo `angleDeg` graus
// no sentido horário. Usado em vez de circle+dasharray pra evitar
// truques de transform/scale que confundem ao revisar o código.
function arcPath(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): string {
  if (angleDeg <= 0) return ''
  const clamped = Math.min(angleDeg, 359.99)
  const startRad = -Math.PI / 2 // 12h
  const endRad = startRad + (clamped * Math.PI) / 180

  const x1 = cx + r * Math.cos(startRad)
  const y1 = cy + r * Math.sin(startRad)
  const x2 = cx + r * Math.cos(endRad)
  const y2 = cy + r * Math.sin(endRad)

  const largeArc = clamped > 180 ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`
}

export function CalorieRing({ consumed, target }: CalorieRingProps) {
  const radius = 60
  const stroke = 10
  const size = (radius + stroke) * 2
  const cx = size / 2
  const cy = size / 2

  const safeTarget = target > 0 ? target : 0
  const pct = safeTarget > 0 ? consumed / safeTarget : 0
  const fillPct = Math.min(pct, 1)
  const color = getCalorieColor(pct)

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(consumed)} de ${Math.round(safeTarget)} kcal consumidos`}
    >
      <svg width={size} height={size}>
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={RING_BG}
          strokeWidth={stroke}
        />
        {fillPct > 0 && (
          <path
            d={arcPath(cx, cy, radius, fillPct * 360)}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            style={{ transition: 'stroke 200ms ease' }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span
          className="text-3xl font-semibold tabular-nums leading-none"
          style={{ color }}
        >
          {Math.round(consumed)}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums mt-1">
          / {Math.round(safeTarget)} kcal
        </span>
      </div>
    </div>
  )
}
