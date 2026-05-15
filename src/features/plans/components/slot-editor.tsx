import { Fragment, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { FoodSearchResult } from '@/features/foods/lib/types'

import type { SlotDraft } from '../lib/draft-types'

import { AlternativeRow } from './option-editor'
import { FoodPickerSheet } from './food-picker-sheet'

interface SlotEditorProps {
  slot: SlotDraft
  onUpdateLabel: (label: string | null) => void
  onRemove: () => void
  onAddAlternativa: (food: FoodSearchResult) => void
  onRemoveAlternativa: (optionId: string) => void
  onUpdateAlternativaQty: (optionId: string, quantityG: number) => void
}

// Card de UM Alimento (slot) dentro de uma refeição.
//
// Estrutura:
//   ┌───────────────────────────────────────────────────────┐
//   │ [Categoria: FRUTAS               ]            [🗑]    │
//   │                                                       │
//   │  [Principal] Mamão papaya          [150g]  [🗑]      │
//   │     95 kcal · P · C · G                              │
//   │  ─────────────                                       │
//   │  Mamão Formosa                     [150g]  [🗑]      │
//   │     90 kcal · ...                                    │
//   │                                                       │
//   │ [+ Adicionar alternativa]                            │
//   └───────────────────────────────────────────────────────┘
//
// Cada slot tem 1+ alternativas. A primeira (sort_order=0) é a
// principal. As outras são substituições puras (motor de Fase 6
// vai operar nesse nível). Não há combinação "E" — modelo bate
// com planos nutricionais reais.
//
// "Adicionar alternativa" abre FoodPickerSheet local. O food
// escolhido vira uma OptionDraft nova (food + qty default).
//
// "Categoria" (label) é livre e opcional. Exemplos: "FRUTAS",
// "PROTEÍNA", "CARBO". Se vazio, no /plano (readonly) cai pra
// "ITEM N" baseado na ordem do slot na refeição.
export function SlotEditor({
  slot,
  onUpdateLabel,
  onRemove,
  onAddAlternativa,
  onRemoveAlternativa,
  onUpdateAlternativaQty,
}: SlotEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false)

  const sortedOptions = useMemo(
    () => [...slot.options].sort((a, b) => a.sort_order - b.sort_order),
    [slot.options],
  )

  const handleRemove = () => {
    const ok = window.confirm(
      'Remover este alimento e todas as suas alternativas?',
    )
    if (!ok) return
    onRemove()
  }

  const handlePick = (food: FoodSearchResult) => {
    onAddAlternativa(food)
  }

  const canRemoveAlternativa = sortedOptions.length > 1

  return (
    <div className="rounded-lg border bg-muted/70 p-3">
      <div className="mb-3 flex items-center gap-2">
        <Input
          value={slot.label ?? ''}
          onChange={(e) => {
            const v = e.target.value
            onUpdateLabel(v.trim() === '' ? null : v)
          }}
          placeholder="Categoria (ex: Frutas, opcional)"
          aria-label="Categoria do alimento"
          className="min-w-0 flex-1"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleRemove}
          aria-label="Remover alimento"
          className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {sortedOptions.length === 0 ? (
        // Edge case: plano antigo migrado pode ter slot sem options.
        // Mostra mensagem amigável + permite adicionar alternativa pra
        // recuperar.
        <p className="mb-2 rounded-md border border-dashed bg-background p-2 text-center text-xs italic text-muted-foreground">
          Sem alternativas ainda. Adicione uma abaixo.
        </p>
      ) : (
        // Lista de alternativas separadas por "ou" — reforça que são
        // exclusivas dentro do slot (idioma de plano de nutricionista
        // no papel). Sem space-y no ul: o próprio "ou" é o espaçador
        // natural entre items (mais compacto).
        <ul className="mb-2">
          {sortedOptions.map((option, idx) => (
            <Fragment key={option.id}>
              {idx > 0 && (
                <li
                  aria-hidden
                  className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  ou
                </li>
              )}
              <AlternativeRow
                option={option}
                isPrimary={idx === 0}
                canRemove={canRemoveAlternativa}
                onUpdateQty={(qty) => onUpdateAlternativaQty(option.id, qty)}
                onRemove={() => onRemoveAlternativa(option.id)}
              />
            </Fragment>
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
        Adicionar alternativa
      </Button>

      <FoodPickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={handlePick}
      />
    </div>
  )
}
