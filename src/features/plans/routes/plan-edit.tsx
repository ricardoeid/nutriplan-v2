import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, AlertTriangle, Save } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { FoodSearchResult } from '@/features/foods/lib/types'

import { usePlanEditor } from '../hooks/use-plan-editor'
import { useSavePlan } from '../hooks/use-save-plan'
import { useActivatePlan } from '../hooks/use-activate-plan'
import { MealEditorCard } from '../components/meal-editor-card'
import {
  compareMealsByTime,
  foodSearchResultToItemFood,
} from '../lib/draft-types'
import { PlanValidationError } from '../lib/errors'

// Editor de plano alimentar.
//
// Modelo de UI (Fase 5 refactor):
//   Refeição
//     └─ Alimento (slot)
//          ├─ Alternativa principal (primeira por sort_order)
//          └─ Alternativas extras
//   Cada alternativa = 1 food + 1 qty. Sem combinação E.
//
// Fluxo do save (B5):
//   1. handleSave dispara useSavePlan.mutateAsync({planId, original, draft})
//   2. PlanValidationError → toast com primeira mensagem
//   3. Após sucesso → refetch (no useSavePlan) → resetDraft → useEffect
//      re-hidrata com ids reais
//   4. Se plano ativo → activate_meal_plan ressincroniza diário de hoje
export default function PlanEditPage() {
  const { id: planId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  if (!planId) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
        <p className="text-sm text-destructive">URL inválida — sem id do plano.</p>
        <Button onClick={() => navigate('/planos')} variant="outline">
          Voltar pros planos
        </Button>
      </div>
    )
  }

  const {
    draft,
    original,
    loading,
    error,
    notFound,
    setPlanName,
    addMeal,
    removeMeal,
    updateMeal,
    addAlimento,
    removeAlimento,
    updateAlimentoLabel,
    addAlternativa,
    removeAlternativa,
    updateAlternativaQty,
    resetDraft,
  } = usePlanEditor(planId)

  const savePlan = useSavePlan()
  const activatePlan = useActivatePlan()

  const sortedMeals = useMemo(() => {
    if (!draft) return []
    return [...draft.meals].sort(compareMealsByTime)
  }, [draft])

  // Quando user escolhe food pra criar um alimento novo (slot):
  // converte FoodSearchResult → ItemDraftFood e cria slot+option+item
  // já com qty default do food.
  const handleAddAlimento = (mealId: string, food: FoodSearchResult) => {
    const itemFood = foodSearchResultToItemFood(food)
    addAlimento(mealId, itemFood, Math.round(food.default_serving_g))
  }

  // Quando user escolhe food pra adicionar alternativa em alimento
  // existente: cria option+item com qty default do food.
  const handleAddAlternativa = (slotId: string, food: FoodSearchResult) => {
    const itemFood = foodSearchResultToItemFood(food)
    addAlternativa(slotId, itemFood, Math.round(food.default_serving_g))
  }

  const isActive = original?.plan.is_active ?? false
  const saving = savePlan.isPending || activatePlan.isPending

  const handleSave = async () => {
    if (!draft || !original) return
    try {
      await savePlan.mutateAsync({ planId, original, draft })
      resetDraft()

      if (isActive) {
        try {
          await activatePlan.mutateAsync(planId)
          toast.success('Plano salvo e sincronizado com hoje.')
        } catch (activateErr) {
          toast.success('Plano salvo. (Falha ao ressincronizar diário.)', {
            description:
              activateErr instanceof Error ? activateErr.message : undefined,
          })
        }
      } else {
        toast.success('Plano salvo.')
      }
    } catch (err) {
      if (err instanceof PlanValidationError) {
        toast.error(err.issues[0] ?? 'Plano inválido.')
        return
      }
      toast.error(
        err instanceof Error
          ? `Erro ao salvar: ${err.message}`
          : 'Erro ao salvar plano.',
      )
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Voltar">
          <Link to="/planos">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="flex-1 truncate text-2xl font-semibold">
          Editor de plano
        </h1>
        {draft && (
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="gap-1"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        )}
      </div>

      <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <strong>Modo edição.</strong> As alterações ficam locais até você
          clicar em <strong>Salvar</strong>. Recarregar a página descarta o
          rascunho.
          {isActive && (
            <>
              {' '}
              Como este plano está <strong>ativo</strong>, salvar também
              sincroniza o diário de hoje.
            </>
          )}
        </div>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">Carregando plano…</p>
      )}

      {error && !loading && (
        <p className="text-sm text-destructive">
          Erro ao carregar plano:{' '}
          {error instanceof Error ? error.message : String(error)}
        </p>
      )}

      {notFound && (
        <div className="rounded-xl border bg-card p-6 text-center">
          <p className="mb-4 text-sm text-muted-foreground">
            Plano não encontrado ou você não tem acesso.
          </p>
          <Button onClick={() => navigate('/planos')} variant="outline">
            Voltar pros planos
          </Button>
        </div>
      )}

      {draft && !loading && (
        <>
          <div className="space-y-1">
            <label
              htmlFor="plan-name"
              className="text-sm font-medium text-muted-foreground"
            >
              Nome do plano
            </label>
            <Input
              id="plan-name"
              value={draft.planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="Nome do plano"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              Refeições ({sortedMeals.length})
            </h2>

            {sortedMeals.length === 0 ? (
              <p className="rounded-md border border-dashed bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                Nenhuma refeição ainda. Adicione a primeira abaixo.
              </p>
            ) : (
              <ul className="space-y-2">
                {sortedMeals.map((meal) => (
                  <MealEditorCard
                    key={meal.id}
                    meal={meal}
                    onUpdate={(patch) => updateMeal(meal.id, patch)}
                    onRemove={() => removeMeal(meal.id)}
                    onAddAlimento={(food) => handleAddAlimento(meal.id, food)}
                    onUpdateAlimentoLabel={updateAlimentoLabel}
                    onRemoveAlimento={removeAlimento}
                    onAddAlternativa={handleAddAlternativa}
                    onRemoveAlternativa={removeAlternativa}
                    onUpdateAlternativaQty={updateAlternativaQty}
                  />
                ))}
              </ul>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={addMeal}
              disabled={saving}
              className="w-full gap-1"
            >
              <Plus className="h-4 w-4" />
              Adicionar refeição
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
