import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { FoodSearchResult } from '@/features/foods/lib/types'

import { type MealDraft, isDraftId } from '../lib/draft-types'
import { mealTotalsDraft } from '../lib/option-macros'

import { FoodPickerSheet } from './food-picker-sheet'
import { SlotEditor } from './slot-editor'

interface MealEditorCardProps {
  meal: MealDraft
  onUpdate: (patch: Partial<Pick<MealDraft, 'name' | 'target_time'>>) => void
  onRemove: () => void
  // Handlers do modelo "Alimento + Alternativa":
  onAddAlimento: (food: FoodSearchResult) => void
  onUpdateAlimentoLabel: (slotId: string, label: string | null) => void
  onRemoveAlimento: (slotId: string) => void
  onAddAlternativa: (slotId: string, food: FoodSearchResult) => void
  onRemoveAlternativa: (optionId: string) => void
  onUpdateAlternativaQty: (optionId: string, quantityG: number) => void
}

// Card editável de UMA refeição dentro do plan-edit.
//
// Layout (mobile-first):
//   ┌─────────────────────────────────────────────┐
//   │ [▸/▾]  [Nome da refeição]  [⏰ HH:MM]  [🗑] │  ← sempre visível
//   ├─────────────────────────────────────────────┤
//   │   [Alimento 1: FRUTAS]                      │
//   │     • Principal — Mamão papaya 150g         │
//   │     • Mamão Formosa 150g                    │
//   │   [Alimento 2: PROTEÍNA]                    │
//   │     • Ovo cozido 165g                       │  ← expandido (default
//   │   [+ Adicionar alimento]                    │     pra refeição nova)
//   └─────────────────────────────────────────────┘
//
// "Adicionar alimento" abre FoodPickerSheet local. O food escolhido
// cria um slot novo já com 1 alternativa principal.
export function MealEditorCard({
  meal,
  onUpdate,
  onRemove,
  onAddAlimento,
  onUpdateAlimentoLabel,
  onRemoveAlimento,
  onAddAlternativa,
  onRemoveAlternativa,
  onUpdateAlternativaQty,
}: MealEditorCardProps) {
  // Init expanded: refeição recém-criada (id `draft-`) abre expandida —
  // economiza 1 click pra começar a popular o conteúdo. Refeições
  // vindas do banco começam colapsadas.
  const [expanded, setExpanded] = useState(() => isDraftId(meal.id))
  const [pickerOpen, setPickerOpen] = useState(false)

  // B7.1: macros somadas dos PRINCIPAIS de cada slot. Mostra mesmo
  // quando refeição colapsada — user vê total sem expandir.
  const totals = useMemo(() => mealTotalsDraft(meal.slots), [meal.slots])
  const hasSlots = meal.slots.length > 0

  const handleRemove = () => {
    const ok = window.confirm(
      `Remover a refeição "${meal.name}" do plano? (Lembre que nada é salvo até clicar em Salvar.)`,
    )
    if (!ok) return
    onRemove()
  }

  const handleTimeChange = (value: string) => {
    onUpdate({ target_time: value === '' ? null : value })
  }

  const handlePick = (food: FoodSearchResult) => {
    onAddAlimento(food)
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

      {hasSlots && (
        <p className="px-3 pb-2 text-xs tabular-nums text-muted-foreground">
          ≈ {Math.round(totals.kcal)} kcal · P {totals.p.toFixed(1)}g · C{' '}
          {totals.c.toFixed(1)}g · G {totals.g.toFixed(1)}g
        </p>
      )}

      {expanded && (
        <div className="space-y-3 border-t bg-muted/20 p-3">
          {meal.slots.length === 0 ? (
            <p className="rounded-md border border-dashed bg-background p-3 text-center text-xs text-muted-foreground">
              Nenhum alimento ainda. Adicione abaixo.
            </p>
          ) : (
            <div className="space-y-3">
              {meal.slots.map((slot) => (
                <SlotEditor
                  key={slot.id}
                  slot={slot}
                  onUpdateLabel={(label) => onUpdateAlimentoLabel(slot.id, label)}
                  onRemove={() => onRemoveAlimento(slot.id)}
                  onAddAlternativa={(food) => onAddAlternativa(slot.id, food)}
                  onRemoveAlternativa={onRemoveAlternativa}
                  onUpdateAlternativaQty={onUpdateAlternativaQty}
                />
              ))}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPickerOpen(true)}
            className="w-full gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar alimento
          </Button>
        </div>
      )}

      <FoodPickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={handlePick}
      />
    </li>
  )
}
