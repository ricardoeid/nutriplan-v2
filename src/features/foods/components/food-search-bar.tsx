import { Search, X } from 'lucide-react'

import { Input } from '@/components/ui/input'

interface FoodSearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
}

// Search bar com ícone à esquerda e botão de limpar (X) à direita
// quando há texto. Layout absolute em cima do <Input> shadcn — `pl-9`
// e `pr-9` reservam espaço pros ícones.
export function FoodSearchBar({
  value,
  onChange,
  placeholder = 'Buscar alimento...',
  autoFocus = false,
}: FoodSearchBarProps) {
  return (
    <div className="relative">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="pl-9 pr-9"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Limpar busca"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
