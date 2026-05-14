import { Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { UnitInput } from '@/components/unit-input'

import type { ItemDraft } from '../lib/draft-types'

interface ItemEditorProps {
  item: ItemDraft
  onUpdateQuantity: (quantityG: number) => void
  onRemove: () => void
}

// Row de UM item dentro de uma opção. Layout horizontal:
//   ┌─────────────────────────────────────────────────────┐
//   │ Frango grelhado · TACO     [150  g]    [🗑]         │
//   │   165 kcal · 31P · 0C · 4G                          │
//   └─────────────────────────────────────────────────────┘
//
// Macros preview computadas client-side a partir de quantity_g e
// food.{macros}_per_100g. Mesmo cálculo do AddFoodQuantityStep da
// Fase 4 — duplicação aceita aqui porque é cálculo trivial e isolar
// num helper seria over-engineer.
//
// UnitInput passa string no onCommit (§3 padrão 7) — converter com
// Number + trocar vírgula por ponto antes de propagar pro state.
//
// Não temos confirmação no remove de item — diferente do remove de
// refeição/slot/option, item é granular e o user pode estar
// experimentando. Se virar problema, adicionamos confirm.
export function ItemEditor({
  item,
  onUpdateQuantity,
  onRemove,
}: ItemEditorProps) {
  const food = item.food
  const qty = item.quantity_g

  // Macros preview. Quando food é null (não deveria acontecer no fluxo
  // normal — addItem sempre seta food), mostra placeholders.
  const factor = food ? qty / 100 : 0
  const kcal = food ? food.kcal_per_100g * factor : 0
  const p = food ? food.protein_per_100g * factor : 0
  const c = food ? food.carb_per_100g * factor : 0
  const g = food ? food.fat_per_100g * factor : 0

  const handleQtyCommit = (v: string | null) => {
    if (v === null) return // user limpou — ignoramos, mantém valor anterior
    const n = Number(v.replace(',', '.'))
    if (Number.isNaN(n) || n <= 0) return // valor inválido — ignoramos
    onUpdateQuantity(n)
  }

  // sourceLabel: mapeia 'taco' → 'TACO', 'custom' → 'Custom', etc.
  // Mantém curto pra não estourar layout em mobile.
  const sourceLabel = food
    ? food.source === 'taco'
      ? 'TACO'
      : food.source === 'open_food_facts'
        ? 'Produto'
        : food.source === 'custom'
          ? 'Custom'
          : food.source === 'composite'
            ? 'Receita'
            : food.source
    : null

  return (
    <li className="rounded-md border bg-background p-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {food?.name ?? '(alimento removido)'}
          </p>
          {food?.brand && (
            <p className="truncate text-xs text-muted-foreground">
              {food.brand}
              {sourceLabel ? ` · ${sourceLabel}` : ''}
            </p>
          )}
          {!food?.brand && sourceLabel && (
            <p className="truncate text-xs text-muted-foreground">
              {sourceLabel}
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

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label="Remover item"
          className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
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
