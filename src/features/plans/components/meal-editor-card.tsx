import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { FoodSearchResult } from '@/features/foods/lib/types'

import { type MealDraft, isDraftId } from '../lib/draft-types'

import { SlotEditor } from './slot-editor'

interface MealEditorCardProps {
  meal: MealDraft
  onUpdate: (patch: Partial<Pick<MealDraft, 'name' | 'target_time'>>) => void
  onRemove: () => void
  // B4: handlers pra slots/options/items que sobem até o hook
  // (usePlanEditor). MealEditorCard só repassa pro SlotEditor.
  onAddSlot: () => void
  onUpdateSlotLabel: (slotId: string, label: string | null) => void
  onRemoveSlot: (slotId: string) => void
  onAddOption: (slotId: string) => void
  onRemoveOption: (optionId: string) => void
  onAddItem: (optionId: string, food: FoodSearchResult) => void
  onUpdateItemQty: (itemId: string, quantityG: number) => void
  onRemoveItem: (itemId: string) => void
}

// Card editável de UMA refeição dentro do plan-edit.
//
// Layout (mobile-first):
//   ┌─────────────────────────────────────────────┐
//   │ [▸/▾]  [Nome da refeição]  [⏰ HH:MM]  [🗑] │  ← sempre visível
//   ├─────────────────────────────────────────────┤
//   │   [Slot 1: Proteína]                        │
//   │     ┌─ Opção 1 ─┐  OU  ┌─ Opção 2 ─┐        │  ← se expandido (B4)
//   │   [+ Adicionar slot]                        │
//   └─────────────────────────────────────────────┘
//
// Inline edits:
//   - Nome: <Input> normal, onChange dispara onUpdate({ name })
//   - target_time: <input type="time"> nativo (mobile-friendly, sem
//     dependência de date-picker lib). Vazio = null (sem horário).
//
// onRemove dispara confirmação simples (window.confirm) só pra evitar
// click acidental — mesma escolha da rota /planos (sem AlertDialog
// shadcn instalado).
export function MealEditorCard({
  meal,
  onUpdate,
  onRemove,
  onAddSlot,
  onUpdateSlotLabel,
  onRemoveSlot,
  onAddOption,
  onRemoveOption,
  onAddItem,
  onUpdateItemQty,
  onRemoveItem,
}: MealEditorCardProps) {
  // Cada card guarda seu próprio estado de expanded. Não vale a pena
  // promover pro hook do editor — o user só interage com 1 card por
  // vez, e "remember expanded after refresh" não é requisito.
  //
  // Init: refeição recém-criada (id começa com `draft-`) abre já
  // expandida — economiza 1 click pro user que acabou de adicionar a
  // refeição e quer colocar slots/items dentro. Refeição vinda do
  // banco (id real) começa colapsada pra dar visão de lista mais
  // limpa. useState(initializer) roda só na primeira montagem do card.
  const [expanded, setExpanded] = useState(() => isDraftId(meal.id))

  const handleRemove = () => {
    const ok = window.confirm(
      `Remover a refeição "${meal.name}" do plano? (Lembre que nada é salvo até o próximo bloco.)`,
    )
    if (!ok) return
    onRemove()
  }

  const handleTimeChange = (value: string) => {
    // HTML <input type="time"> devolve '' quando user limpa, 'HH:MM'
    // quando preenche. Normalizamos pra null/'HH:MM' no draft.
    onUpdate({ target_time: value === '' ? null : value })
  }

  return (
    <li className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Recolher refeição' : 'Expandir refeição'}
          aria-expanded={expanded}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-accent"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <Input
          value={meal.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Nome da refeição"
          className="min-w-0 flex-1"
          aria-label="Nome da refeição"
        />

        <input
          type="time"
          value={meal.target_time ?? ''}
          onChange={(e) => handleTimeChange(e.target.value)}
          aria-label="Horário da refeição"
          // Estilo manual pra casar com Input shadcn (mesma altura/borda).
          // Sem nativo de shadcn pra time input, então usamos o cru.
          className="h-10 w-[110px] shrink-0 rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleRemove}
          aria-label="Remover refeição"
          className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t bg-muted/20 p-3">
          {meal.slots.length === 0 ? (
            <p className="rounded-md border border-dashed bg-background p-3 text-center text-xs text-muted-foreground">
              Nenhum slot. Adicione um abaixo (ex: "Proteína", "Carbo").
            </p>
          ) : (
            <div className="space-y-3">
              {meal.slots.map((slot) => (
                <SlotEditor
                  key={slot.id}
                  slot={slot}
                  onUpdateLabel={(label) => onUpdateSlotLabel(slot.id, label)}
                  onRemove={() => onRemoveSlot(slot.id)}
                  onAddOption={() => onAddOption(slot.id)}
                  onRemoveOption={onRemoveOption}
                  onAddItem={onAddItem}
                  onUpdateItemQty={onUpdateItemQty}
                  onRemoveItem={onRemoveItem}
                />
              ))}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddSlot}
            className="w-full gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar slot
          </Button>
        </div>
      )}
    </li>
  )
}
