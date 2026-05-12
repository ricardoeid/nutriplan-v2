import { useEffect, useRef, useState } from 'react'
import { EyeOff, MoreVertical } from 'lucide-react'

import { cn } from '@/lib/utils'

interface FoodRowMenuProps {
  onHide: () => void
  // Disabled enquanto a mutation tá pendente — UX previne duplo-clique.
  disabled?: boolean
}

// Pop-out menu pra ações da row (••• → Ocultar).
//
// Implementação manual em vez de shadcn DropdownMenu pra evitar
// instalar @radix-ui/react-dropdown-menu. Comportamento:
//   - Click no botão ••• abre menu
//   - Click em qualquer item executa ação E fecha menu
//   - Click FORA do menu fecha (mas não dispara nada)
//   - Tecla Escape fecha
//   - z-index alto pra ficar acima da row (relative)
//
// Quando precisarmos de mais ações (Logar, Adicionar ao plano,
// Editar, Excluir) — convertível pra shadcn sheet/dropdown sem
// quebrar o caller.
export function FoodRowMenu({ onHide, disabled = false }: FoodRowMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fecha ao clicar fora ou apertar Esc.
  // useEffect só registra listeners enquanto open=true pra evitar
  // overhead em centenas de rows do listing.
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
    // Impede que o click navegue (a row inteira é um <Link>).
    e.preventDefault()
    e.stopPropagation()
    setOpen((v) => !v)
  }

  const handleHide = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen(false)
    onHide()
  }

  return (
    <div ref={containerRef} className="relative">
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
          className="absolute right-0 top-full z-20 mt-1 min-w-[140px] overflow-hidden rounded-md border border-border bg-popover shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleHide}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-popover-foreground transition-colors hover:bg-muted"
          >
            <EyeOff className="h-4 w-4" />
            Ocultar
          </button>
        </div>
      )}
    </div>
  )
}
