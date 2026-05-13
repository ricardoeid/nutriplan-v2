import { useState } from 'react'

import { getTodayBR } from '@/lib/dates'

import { DailyProgressCard } from '../components/daily-progress-card'
import { DateNavigator } from '../components/date-navigator'
import { useDailyLog } from '../hooks/use-daily-log'

// Home autenticada (Diário Diário). Match visual V1:
//   - Header só com DateNavigator no formato "◀ 📅 Hoje, 13 de maio ▶"
//     (sem botões "Alimentos"/"Perfil" — esses ficam no BottomNav)
//   - DailyProgressCard (B4) com ring kcal + barras de macros + "Restante"
//   - MealCards (B5) — em construção
//   - `pb-24` reserva espaço pro BottomNav fixed.
function HomePage() {
  const [dateISO, setDateISO] = useState(getTodayBR())
  const { dailyLog, totals, loading, error } = useDailyLog(dateISO)

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="max-w-md mx-auto p-3">
          <DateNavigator dateISO={dateISO} onDateChange={setDateISO} />
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        {loading && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Carregando diário...
          </p>
        )}
        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error instanceof Error
              ? error.message
              : 'Erro ao carregar diário'}
          </p>
        )}
        {!loading && !error && (
          <>
            <DailyProgressCard totals={totals} dailyLog={dailyLog} />
            <p className="text-sm text-muted-foreground text-center py-8">
              MealCards chegam no B5.
            </p>
          </>
        )}
      </main>
    </div>
  )
}

export default HomePage
