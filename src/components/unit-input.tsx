import { useState } from 'react'

import { Input } from '@/components/ui/input'

// Wrapper de Input que mostra uma unidade fixa à direita (ex: kcal, g, %).
//
// Comportamento crucial: usa state local de string durante a edição pra
// NÃO interromper a digitação. O valor só é "comitado" pro pai no onBlur
// ou Enter. Corrige o "pulo de casa decimal" do V1 (input controlled +
// onChange imediato fazia a posição do cursor pular quando o pai
// reformatava o número).
//
// Originalmente vivia dentro de macro-editor.tsx. Extraído porque o
// AddFoodFlow (B7 da Fase 4) também precisa do mesmo wrapper pra
// quantidade em gramas.

interface UnitInputProps {
  type: 'integer' | 'decimal'
  unit: string
  value: string | number | null
  onCommit: (value: string | null) => void
  disabled?: boolean
  placeholder?: string
  autoFocus?: boolean
}

export function UnitInput({
  type,
  unit,
  value,
  onCommit,
  disabled,
  placeholder,
  autoFocus,
}: UnitInputProps) {
  const [editing, setEditing] = useState<string | null>(null)

  const display =
    editing !== null
      ? editing
      : value === null || value === undefined
        ? ''
        : String(value)

  const commit = () => {
    if (editing === null) return
    onCommit(editing.trim() === '' ? null : editing.trim())
    setEditing(null)
  }

  return (
    <div className="relative">
      <Input
        type="text"
        inputMode={type === 'integer' ? 'numeric' : 'decimal'}
        disabled={disabled}
        value={display}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => setEditing(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        className="pr-10"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
        {unit}
      </span>
    </div>
  )
}
