import { useState } from 'react'
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import type { MealDraft } from '../lib/draft-types'

interface MealEditorCardProps {
  meal: MealDraft
  onUpdate: (patch: Partial<Pick<MealDraft, 'name' | 'target_time'>>) => void
  onRemove: () => void
}

// Card editável de UMA refeição dentro do plan-edit.
//
// Layout (mobile-first):
//   ┌─────────────────────────────────────────────┐
//   │ [▸/▾]  [Nome da refeição]  [⏰ HH:MM]  [🗑] │  ← sempre visível
//   ├─────────────────────────────────────────────┤
//   │   Slots e opções chegam no próximo bloco    │  ← se expandido (B3 placeholder)
//   └─────────────────────────────────────────────┘
//
// O B4 vai popular o corpo expandido com slots → options → items.
// Por isso o card já é expandível desde o B3 — quando B4 chegar, só
// substitui o placeholder pelo render de slots.
//
// Edits inline:
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
}: MealEditorCardProps) {
  // Cada card guarda seu próprio estado de expanded. Não vale a pena
  // promover pro hook do editor — o user só interage com 1 card por
  // vez, e "remember expanded after refresh" não é requisito.
  const [expanded, setExpanded] = useState(false)

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
        <div className="border-t px-3 py-3">
          <p className="text-sm italic text-muted-foreground">
            Slots e opções chegam no próximo bloco (B4).
          </p>
        </div>
      )}
    </li>
  )
}
