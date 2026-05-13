import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { getTodayBR } from '@/lib/dates'
import type { FoodSearchResult } from '@/features/foods/lib/types'

import { AddFoodSheet } from '../components/add-food-sheet'
import { DailyProgressCard } from '../components/daily-progress-card'
import { DateNavigator } from '../components/date-navigator'
import { MealCard } from '../components/meal-card'
import { NewMealDialog } from '../components/new-meal-dialog'
import { useAddEntry } from '../hooks/use-add-entry'
import { useCreateMeal } from '../hooks/use-create-meal'
import { useDailyLog } from '../hooks/use-daily-log'
import { useDeleteEntry } from '../hooks/use-delete-entry'
import { useDeleteMeal } from '../hooks/use-delete-meal'

// Home autenticada (Diário Diário). Match visual V1:
//   - Header: DateNavigator "◀ 📅 Hoje, 13 de maio ▶"
//   - DailyProgressCard: ring kcal + barras macro + "Restante"
//   - Lista de MealCards (uma por log_meal)
//   - Botão "Adicionar refeição" abre NewMealDialog (B6)
//   - "+ Adicionar alimento" em cada MealCard abre AddFoodSheet (B7)
//
// IMPORTANTE — todas as mutations (delete entry/meal, create meal, add
// entry) vivem AQUI, não dentro de MealCard. Motivo: optimistic update
// remove a meal/entry da lista, MealCard desmonta antes do server
// responder. Se a mutation estivesse no MealCard, os callbacks
// (onSuccess/onError) seriam droppados pelo TanStack Query v5. Home
// não desmonta nesses casos, então segura os callbacks vivos.
function HomePage() {
  const [dateISO, setDateISO] = useState(getTodayBR())
  const [newMealOpen, setNewMealOpen] = useState(false)
  const [addFoodMealId, setAddFoodMealId] = useState<string | undefined>(
    undefined,
  )
  const [addFoodOpen, setAddFoodOpen] = useState(false)

  const { dailyLog, meals, totals, loading, error } = useDailyLog(dateISO)
  const deleteEntry = useDeleteEntry()
  const deleteMeal = useDeleteMeal()
  const createMeal = useCreateMeal()
  const addEntry = useAddEntry()

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

  const handleCreateMeal = (values: {
    name: string
    target_time?: string
  }) => {
    if (!dailyLog) return
    createMeal.mutate(
      {
        dailyLogId: dailyLog.id,
        dateISO,
        name: values.name,
        target_time: values.target_time,
      },
      {
        onSuccess: () => {
          toast.success(`"${values.name}" adicionada`)
          setNewMealOpen(false)
        },
        onError: (err) =>
          toast.error(
            err instanceof Error
              ? `Erro ao adicionar: ${err.message}`
              : 'Erro ao adicionar refeição.',
          ),
      },
    )
  }

  const handleOpenAddFood = (mealId: string) => {
    setAddFoodMealId(mealId)
    setAddFoodOpen(true)
  }

  const handleAddFoodConfirm = (params: {
    mealId: string
    food: FoodSearchResult
    quantityG: number
  }) => {
    addEntry.mutate(
      {
        mealId: params.mealId,
        dateISO,
        food: {
          id: params.food.id,
          name: params.food.name,
          brand: params.food.brand,
          source: params.food.source,
          serving_label: params.food.serving_label,
          default_serving_g: params.food.default_serving_g,
          kcal_per_100g: params.food.kcal_per_100g,
          protein_per_100g: params.food.protein_per_100g,
          carb_per_100g: params.food.carb_per_100g,
          fat_per_100g: params.food.fat_per_100g,
        },
        quantityG: params.quantityG,
      },
      {
        onSuccess: () => {
          toast.success(`${params.food.name} adicionado`)
          setAddFoodOpen(false)
        },
        onError: (err) =>
          toast.error(
            err instanceof Error
              ? `Erro ao adicionar: ${err.message}`
              : 'Erro ao adicionar alimento.',
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
                  onAddFood={handleOpenAddFood}
                  deleteEntryPending={deleteEntry.isPending}
                  deleteMealPending={deleteMeal.isPending}
                />
              ))
            )}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setNewMealOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar refeição
            </Button>
          </>
        )}
      </main>

      <NewMealDialog
        open={newMealOpen}
        onOpenChange={setNewMealOpen}
        onSubmit={handleCreateMeal}
        submitting={createMeal.isPending}
      />

      <AddFoodSheet
        open={addFoodOpen}
        onOpenChange={setAddFoodOpen}
        meals={meals}
        preSelectedMealId={addFoodMealId}
        onConfirm={handleAddFoodConfirm}
        submitting={addEntry.isPending}
      />
    </div>
  )
}

export default HomePage
