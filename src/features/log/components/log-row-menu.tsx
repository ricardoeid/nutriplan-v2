import { useEffect, useRef, useState } from 'react'
import { MoreVertical, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'

// Pop-out menu compartilhado de ações de row no diário (••• → Excluir).
// Usado tanto em MealCard (excluir refeição inteira) quanto em EntryRow
// (excluir item da refeição). Por enquanto só Excluir; quando precisarmos
// de mais ações ("Mover", "Duplicar", etc.) é só estender o JSX.
//
// Implementação manual igual a food-row-menu (sem @radix-ui/dropdown).
// Fecha em click-outside + Esc; z-index acima do card.

interface LogRowMenuProps {
  onDelete: () => void
  // Label customizável pra distinguir "Excluir refeição" vs "Excluir".
  deleteLabel?: string
  // Disabled enquanto mutation pendente, previne duplo-clique.
  disabled?: boolean
}

export function LogRowMenu({
  onDelete,
  deleteLabel = 'Excluir',
  disabled = false,
}: LogRowMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen((v) => !v)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen(false)
    onDelete()
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={handleTriggerClick}
        disabled={disabled}
        aria-label="Mais opções"
        aria-haspopup="true"
        aria-expanded={open}
        className={cn(
          'rounded-sm p-1 transition-colors disabled:opacity-50',
          'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-[160px] overflow-hidden rounded-md border border-border bg-popover shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleDelete}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-muted"
          >
            <Trash2 className="h-4 w-4" />
            {deleteLabel}
          </button>
        </div>
      )}
    </div>
  )
}
