import { useState } from 'react'
import { Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { FoodSearchResult } from '@/features/foods/lib/types'

import type { OptionDraft } from '../lib/draft-types'

import { FoodPickerSheet } from './food-picker-sheet'
import { ItemEditor } from './item-editor'

interface OptionEditorProps {
  option: OptionDraft
  // 1-based pra display ("Opção 1", "Opção 2"). Calculado pelo pai
  // (SlotEditor) com base no índice no array.
  optionNumber: number
  // True quando há mais de 1 option no slot — mostra botão pra remover
  // esta opção. Se for a única, não pode remover (slot tem que ter
  // pelo menos 1 option pra ser válido).
  canRemove: boolean
  onAddItem: (food: FoodSearchResult) => void
  onUpdateItemQty: (itemId: string, quantityG: number) => void
  onRemoveItem: (itemId: string) => void
  onRemove: () => void
}

// Card de uma opção dentro de um slot. Renderiza:
//   - Header: "Opção N" + botão X (se canRemove)
//   - Lista de items (ItemEditor cada)
//   - Botão "+ Adicionar item" → abre FoodPickerSheet
//
// Items dentro da opção são combinados com "E" — ex: Arroz 100g + Feijão
// 80g é a Opção 1; user que escolher essa opção come os dois juntos.
//
// O badge "OU" entre opções fica no SlotEditor (responsabilidade do pai,
// porque depende da posição relativa).
export function OptionEditor({
  option,
  optionNumber,
  canRemove,
  onAddItem,
  onUpdateItemQty,
  onRemoveItem,
  onRemove,
}: OptionEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium">Opção {optionNumber}</h4>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remover opção"
            className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {option.items.length === 0 ? (
        <p className="mb-2 rounded-md border border-dashed bg-background/60 p-2 text-center text-xs text-muted-foreground">
          Nenhum alimento. Adicione abaixo.
        </p>
      ) : (
        <ul className="mb-2 space-y-1.5">
          {option.items.map((item) => (
            <ItemEditor
              key={item.id}
              item={item}
              onUpdateQuantity={(qty) => onUpdateItemQty(item.id, qty)}
              onRemove={() => onRemoveItem(item.id)}
            />
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setPickerOpen(true)}
        className="w-full justify-start gap-1 text-muted-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar alimento
      </Button>

      <FoodPickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={(food) => {
          // Sheet fecha sozinho via onOpenChange dentro do FoodPickerSheet.
          // Apenas propagamos o food selecionado pro pai — a conversão
          // pra ItemDraftFood + chamada de addItem (com qty default)
          // acontece no plan-edit.tsx onde temos acesso ao hook.
          onAddItem(food)
        }}
      />
    </div>
  )
}
