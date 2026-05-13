import { useState } from 'react'
import { toast } from 'sonner'

import { getTodayBR } from '@/lib/dates'

import { DailyProgressCard } from '../components/daily-progress-card'
import { DateNavigator } from '../components/date-navigator'
import { MealCard } from '../components/meal-card'
import { useDailyLog } from '../hooks/use-daily-log'
import { useDeleteEntry } from '../hooks/use-delete-entry'
import { useDeleteMeal } from '../hooks/use-delete-meal'

// Home autenticada (Diário Diário). Match visual V1:
//   - Header: DateNavigator "◀ 📅 Hoje, 13 de maio ▶"
//   - DailyProgressCard: ring kcal + barras macro + "Restante"
//   - Lista de MealCards (uma por log_meal)
//   - Botão "Adicionar refeição" (B6 wires; por enquanto não está aqui)
//
// IMPORTANTE — as mutations de delete vivem AQUI, não dentro de MealCard.
// Motivo: optimistic update remove a meal/entry da lista de cache, fazendo
// o MealCard correspondente desmontar antes do server responder. Se a
// mutation estivesse no MealCard, os callbacks (onSuccess/onError) seriam
// droppados pelo TanStack Query v5 — toast não apareceria E rollback de
// erro não rodaria. Home não desmonta nesses casos, então segura os
// callbacks vivos. (Bug pego no B5; lição capturada em comentário.)
//
// `pb-24` reserva espaço pro BottomNav fixed.
function HomePage() {
  const [dateISO, setDateISO] = useState(getTodayBR())
  const { dailyLog, meals, totals, loading, error } = useDailyLog(dateISO)
  const deleteEntry = useDeleteEntry()
  const deleteMeal = useDeleteMeal()

  const handleDeleteEntry = (entryId: string) => {
    deleteEntry.mutate(
      { entryId, dateISO },
      {
        onSuccess: () => toast.success('Item removido'),
        onError: (err) =>
          toast.error(
            err instanceof Error
              ? `Erro ao remover: ${err.message}`
              : 'Erro ao remover.',
          ),
      },
    )
  }

  const handleDeleteMeal = (mealId: string, mealName: string) => {
    deleteMeal.mutate(
      { mealId, dateISO },
      {
        onSuccess: () => toast.success(`"${mealName}" removida`),
        onError: (err) =>
          toast.error(
            err instanceof Error
              ? `Erro ao remover: ${err.message}`
              : 'Erro ao remover.',
          ),
      },
    )
  }

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
            {meals.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Sem refeições neste dia.
              </p>
            ) : (
              meals.map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  onDeleteEntry={handleDeleteEntry}
                  onDeleteMeal={handleDeleteMeal}
                  deleteEntryPending={deleteEntry.isPending}
                  deleteMealPending={deleteMeal.isPending}
                />
              ))
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default HomePage
