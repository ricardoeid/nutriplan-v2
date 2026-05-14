import { Fragment } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { FoodSearchResult } from '@/features/foods/lib/types'

import type { SlotDraft } from '../lib/draft-types'

import { OptionEditor } from './option-editor'

interface SlotEditorProps {
  slot: SlotDraft
  onUpdateLabel: (label: string | null) => void
  onRemove: () => void
  onAddOption: () => void
  onRemoveOption: (optionId: string) => void
  onAddItem: (optionId: string, food: FoodSearchResult) => void
  onUpdateItemQty: (itemId: string, quantityG: number) => void
  onRemoveItem: (itemId: string) => void
}

// Card de um slot dentro de uma refeição. Estrutura:
//   ┌───────────────────────────────────────────────────────┐
//   │ [Label: "Proteína"]                          [🗑]     │
//   │ ┌─────────────────────────────────────────────────┐   │
//   │ │ Opção 1                                   [×]   │   │
//   │ │   • Frango grelhado · 150g · 248 kcal          │   │
//   │ │   [+ Adicionar alimento]                        │   │
//   │ └─────────────────────────────────────────────────┘   │
//   │                       ─ OU ─                          │
//   │ ┌─────────────────────────────────────────────────┐   │
//   │ │ Opção 2                                   [×]   │   │
//   │ │   ...                                            │   │
//   │ └─────────────────────────────────────────────────┘   │
//   │ [+ Adicionar opção]                                   │
//   └───────────────────────────────────────────────────────┘
//
// O badge "OU" entre options é renderizado aqui (não no OptionEditor)
// porque depende de saber se há próximo elemento na lista.
//
// Label do slot é opcional — input vazio = null no draft. User pode
// usar como categoria ("Proteína", "Carbo", "Salada") ou deixar em
// branco se não quer categorizar.
export function SlotEditor({
  slot,
  onUpdateLabel,
  onRemove,
  onAddOption,
  onRemoveOption,
  onAddItem,
  onUpdateItemQty,
  onRemoveItem,
}: SlotEditorProps) {
  const handleRemove = () => {
    // Slot pode ter conteúdo (options/items) — confirmar pra evitar
    // perda acidental. Mesmo sem save (B3-B4), o draft já tem trabalho.
    const ok = window.confirm(
      'Remover este slot e tudo dentro dele (opções e alimentos)?',
    )
    if (!ok) return
    onRemove()
  }

  const canRemoveOption = slot.options.length > 1

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-3 flex items-center gap-2">
        <Input
          value={slot.label ?? ''}
          onChange={(e) => {
            const v = e.target.value
            onUpdateLabel(v.trim() === '' ? null : v)
          }}
          placeholder="Categoria (ex: Proteína, opcional)"
          aria-label="Categoria do slot"
          className="min-w-0 flex-1"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleRemove}
          aria-label="Remover slot"
          className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        {slot.options.map((option, idx) => (
          <Fragment key={option.id}>
            <OptionEditor
              option={option}
              optionNumber={idx + 1}
              canRemove={canRemoveOption}
              onAddItem={(food) => onAddItem(option.id, food)}
              onUpdateItemQty={onUpdateItemQty}
              onRemoveItem={onRemoveItem}
              onRemove={() => onRemoveOption(option.id)}
            />
            {idx < slot.options.length - 1 && (
              <div className="flex items-center gap-2 py-0.5">
                <div className="h-px flex-1 bg-border" />
                <span className="rounded-full border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  OU
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}
          </Fragment>
        ))}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onAddOption}
        className="mt-2 w-full justify-start gap-1 text-muted-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar opção
      </Button>
    </div>
  )
}
