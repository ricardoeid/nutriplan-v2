import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { addDaysISO, formatDateDDMM, getTodayBR } from '@/lib/dates'

interface DateNavigatorProps {
  dateISO: string
  onDateChange: (dateISO: string) => void
}

// Navegação de data do diário: setas ◀ ▶ + display DD/MM no centro.
//
// Regras:
//   - Setinha pra trás sempre habilitada (pode ver passado livremente).
//   - Setinha pra frente bloqueada quando dateISO === hoje BR. Motivo:
//     cada navegação dispara `get_or_create_daily_log` no banco — se
//     permitirmos futuro, poluímos o DB com daily_logs vazios. Sem
//     plano-ativo-UI ainda (Fase 5), não tem ganho compensar.
//   - Clicar no texto DD/MM volta pra hoje (atalho).
//   - Quando está em hoje, mostra " · Hoje" ao lado em cor primária.
//
// `tabular-nums` mantém os dígitos alinhados quando navega entre datas.
export function DateNavigator({ dateISO, onDateChange }: DateNavigatorProps) {
  const today = getTodayBR()
  const isOnToday = dateISO === today
  const canGoForward = dateISO < today

  return (
    <div className="flex items-center justify-between gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDateChange(addDaysISO(dateISO, -1))}
        aria-label="Dia anterior"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>

      <button
        type="button"
        onClick={() => onDateChange(today)}
        className="text-lg font-medium tabular-nums px-3 py-1 rounded hover:bg-accent transition-colors"
        aria-label={isOnToday ? 'Hoje' : 'Voltar para hoje'}
      >
        {formatDateDDMM(dateISO)}
        {isOnToday && (
          <span className="ml-2 text-xs text-primary font-normal">Hoje</span>
        )}
      </button>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDateChange(addDaysISO(dateISO, +1))}
        disabled={!canGoForward}
        aria-label="Próximo dia"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  )
}
