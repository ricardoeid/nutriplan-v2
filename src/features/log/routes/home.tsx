import { useState } from 'react'

import { getTodayBR } from '@/lib/dates'

import { DateNavigator } from '../components/date-navigator'

// Home autenticada (Diário Diário). Match visual V1:
//   - Header só com DateNavigator no formato "◀ 📅 Hoje, 13 de maio ▶"
//     (sem botões "Alimentos"/"Perfil" — esses ficam no BottomNav)
//   - Conteúdo: placeholder no B3.5; ganha DailyProgressCard no B4,
//     MealCards no B5, NewMealDialog no B6.
//   - `pb-20` reserva espaço pro BottomNav fixed.
function HomePage() {
  const [dateISO, setDateISO] = useState(getTodayBR())

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="max-w-md mx-auto p-3">
          <DateNavigator dateISO={dateISO} onDateChange={setDateISO} />
        </div>
      </header>

      <main className="max-w-md mx-auto p-4">
        <p className="text-sm text-muted-foreground text-center py-12">
          Data selecionada: <span className="tabular-nums">{dateISO}</span>
          <br />
          <span className="text-xs">
            DailyProgressCard chega no B4, MealCards no B5.
          </span>
        </p>
      </main>
    </div>
  )
}

export default HomePage
