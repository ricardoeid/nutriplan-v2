import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { getTodayBR } from '@/lib/dates'

import { DateNavigator } from '../components/date-navigator'

// Home autenticada (Diário Diário). Esqueleto do B3:
//   - Header com título + links pra /foods e /profile.
//   - DateNavigator pra trocar de dia.
//   - Conteúdo é placeholder; B4 preenche com DailyProgressCard,
//     B5 com MealCards.
//
// `dateISO` em state local (não na URL por enquanto — decisão de B3:
// deep-link via query param fica como pós-MVP, simplifica AuthGuard
// + onboarding redirect sem precisar preservar state).
function HomePage() {
  const [dateISO, setDateISO] = useState(getTodayBR())

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="max-w-md mx-auto p-4 flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">Diário</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/foods">Alimentos</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/profile">Perfil</Link>
            </Button>
          </div>
        </div>
        <div className="max-w-md mx-auto px-4 pb-3">
          <DateNavigator dateISO={dateISO} onDateChange={setDateISO} />
        </div>
      </header>

      <main className="max-w-md mx-auto p-4">
        <p className="text-sm text-muted-foreground text-center py-12">
          Data selecionada: <span className="tabular-nums">{dateISO}</span>
          <br />
          <span className="text-xs">
            Diário em construção — dados aparecem no próximo bloco.
          </span>
        </p>
      </main>
    </div>
  )
}

export default HomePage
