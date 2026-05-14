import { Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { UnitInput } from '@/components/unit-input'

import {
  type OptionDraft,
  getOptionFood,
  getOptionQty,
} from '../lib/draft-types'

interface AlternativeRowProps {
  option: OptionDraft
  // True quando essa alternativa tem o menor sort_order do slot.
  // Mostra badge "Principal" pra dar pistas visuais. No save, "principal"
  // é definida apenas pelo sort_order (não há flag no banco).
  isPrimary: boolean
  // True quando há 2+ alternativas no slot — habilita o botão de
  // remover. Slot precisa de no mínimo 1 alternativa pra ser válido.
  canRemove: boolean
  onUpdateQty: (quantityG: number) => void
  onRemove: () => void
}

// Row de UMA alternativa dentro de um Alimento (slot).
//
// Layout horizontal:
//   ┌────────────────────────────────────────────────────┐
//   │ [Principal] Banana prata               [150  g] [🗑]│
//   │   95 kcal · P 1g · C 24g · G 0.4g                  │
//   └────────────────────────────────────────────────────┘
//
// Cada alternativa carrega 1 food (não combinação E). Banco mantém
// option_items por baixo, mas a UI usa helpers getOptionFood/getOptionQty.
// Trocar o food é feito removendo + adicionando outra alternativa
// (mais simples e raramente necessário).
//
// Macros preview computadas client-side a partir de quantity_g e
// food.{macros}_per_100g. Mesmo cálculo dos demais lugares.
//
// UnitInput passa string no onCommit (§3 padrão 7) — converter com
// Number + trocar vírgula por ponto antes de propagar pro state.
export function AlternativeRow({
  option,
  isPrimary,
  canRemove,
  onUpdateQty,
  onRemove,
}: AlternativeRowProps) {
  const food = getOptionFood(option)
  const qty = getOptionQty(option)

  // Macros preview. Quando food é null (caso edge de plano antigo com
  // option sem item), mostra placeholders e oculta o preview de macros.
  const factor = food ? qty / 100 : 0
  const kcal = food ? food.kcal_per_100g * factor : 0
  const p = food ? food.protein_per_100g * factor : 0
  const c = food ? food.carb_per_100g * factor : 0
  const g = food ? food.fat_per_100g * factor : 0

  const handleQtyCommit = (v: string | null) => {
    if (v === null) return
    const n = Number(v.replace(',', '.'))
    if (Number.isNaN(n) || n <= 0) return
    onUpdateQty(n)
  }

  return (
    <li className="rounded-md border bg-background p-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {isPrimary && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                Principal
              </span>
            )}
            <p className="truncate text-sm font-medium">
              {food?.name ?? '(sem alimento)'}
            </p>
          </div>
          {food?.brand && (
            <p className="truncate text-xs text-muted-foreground">
              {food.brand}
            </p>
          )}
        </div>

        <div className="w-[100px] shrink-0">
          <UnitInput
            type="decimal"
            unit="g"
            value={qty}
            onCommit={handleQtyCommit}
          />
        </div>

        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label="Remover alternativa"
            className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {food && (
        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
          {Math.round(kcal)} kcal · P {p.toFixed(1)}g · C {c.toFixed(1)}g · G{' '}
          {g.toFixed(1)}g
        </p>
      )}
    </li>
  )
}
