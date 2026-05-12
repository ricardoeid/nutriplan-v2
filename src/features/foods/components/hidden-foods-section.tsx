import { useState } from 'react'
import { ChevronDown, ChevronRight, Eye } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { useHiddenFoods } from '../hooks/use-hidden-foods'
import { useToggleHide } from '../hooks/use-toggle-hide'

// Seção colapsável no /profile listando alimentos ocultos.
// Colapsada por default — feature secundária, poucos users a usam.
//
// Cada row tem botão "Desocultar" que dispara a mutation. O mutation
// invalida `foodKeys.all` no onSettled, então a lista se atualiza
// sozinha (a row some).
export function HiddenFoodsSection() {
  const [expanded, setExpanded] = useState(false)
  const { hiddenFoods, loading } = useHiddenFoods()
  const toggleHide = useToggleHide()

  const handleUnhide = (id: string, name: string) => {
    toggleHide.mutate(
      { foodId: id, currentIsHidden: true },
      {
        onSuccess: () => {
          toast.success(`"${name}" desocultado`)
        },
      },
    )
  }

  const pendingId =
    toggleHide.isPending && toggleHide.variables
      ? toggleHide.variables.foodId
      : null

  // Conta no header pra dar contexto antes de expandir
  const count = hiddenFoods.length

  return (
    <section className="rounded-md border border-border bg-card">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">Alimentos ocultos</span>
          {!loading && (
            <span className="text-xs text-muted-foreground">
              ({count})
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-3">
          {loading ? (
            <p className="text-xs text-muted-foreground">Carregando...</p>
          ) : count === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhum alimento oculto.
            </p>
          ) : (
            <ul className="space-y-1">
              {hiddenFoods.map((f) => {
                const isPending = pendingId === f.id
                return (
                  <li
                    key={f.id}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm',
                      isPending && 'opacity-50',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{f.name}</div>
                      {f.brand && (
                        <div className="truncate text-xs text-muted-foreground">
                          {f.brand}
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnhide(f.id, f.name)}
                      disabled={isPending}
                    >
                      <Eye className="mr-1 h-3.5 w-3.5" />
                      Desocultar
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
