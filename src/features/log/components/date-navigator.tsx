import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { addDaysISO, formatDateLongBR, getTodayBR } from '@/lib/dates'

interface DateNavigatorProps {
  dateISO: string
  onDateChange: (dateISO: string) => void
}

// Navegação de data do diário, formato V1: ◀ [📅 Hoje, 13 de maio] ▶
//
// Regras:
//   - Setinha pra trás sempre habilitada (passado livre).
//   - Setinha pra frente bloqueada quando dateISO === hoje BR. Motivo:
//     cada navegação chama `get_or_create_daily_log`, que CRIA o
//     daily_log no banco — sem UI de plano ativo (Fase 5), ir pro
//     futuro só polui o DB com logs vazios.
//   - Centro: ícone calendário + "Hoje, 13 de maio" (clicável → volta
//     pra hoje quando não está em hoje).
//   - `tabular-nums` mantém o número do dia alinhado entre navegações.
export function DateNavigator({ dateISO, onDateChange }: DateNavigatorProps) {
  const today = getTodayBR()
  const isOnToday = dateISO === today
  const canGoForward = dateISO < today

  const dateLong = formatDateLongBR(dateISO)
  const label = isOnToday ? `Hoje, ${dateLong}` : dateLong

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
        disabled={isOnToday}
        className="flex items-center gap-2 px-3 py-1 rounded hover:bg-accent disabled:hover:bg-transparent disabled:cursor-default transition-colors"
        aria-label={isOnToday ? 'Hoje' : 'Voltar para hoje'}
      >
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <span className="text-base font-medium tabular-nums">{label}</span>
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
