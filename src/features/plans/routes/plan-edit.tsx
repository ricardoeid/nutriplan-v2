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
// B3: layout esqueleto + edição de refeições.
// B4: slots + options (OR) + items + FoodPickerSheet.
// B5: save com diff FK-safe + validação + ressync diário se ativo.
//
// Ordenação das refeições: auto por target_time crescente (null vai pro
// fim). Decisão de UX da Fase 5.
//
// Fluxo do save:
//   1. handleSave dispara useSavePlan.mutateAsync({planId, original, draft})
//   2. Se PlanValidationError → toast com primeira mensagem, não chama banco
//   3. Após sucesso do save → refetch da tree já aconteceu (no useSavePlan)
//   4. resetDraft() → useEffect re-hidrata o draft com ids reais
//   5. Se o plano é ativo → activate_meal_plan pra ressincronizar diário
//      de hoje (resolve P14). Toast condicional.
export default function PlanEditPage() {
  const { id: planId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // Validação trivial: se a rota for chamada sem id (não deveria, mas
  // defensive), mostra erro amigável.
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
    addSlot,
    removeSlot,
    updateSlot,
    addOption,
    removeOption,
    addItem,
    removeItem,
    updateItem,
    resetDraft,
  } = usePlanEditor(planId)

  const savePlan = useSavePlan()
  const activatePlan = useActivatePlan()

  // Ordenação visual aplicada na hora do render. Não muta o draft —
  // sort_order continua sendo a ordem de adição até o B5 normalizar.
  const sortedMeals = useMemo(() => {
    if (!draft) return []
    return [...draft.meals].sort(compareMealsByTime)
  }, [draft])

  // Quando user escolhe um food no FoodPickerSheet (dentro do
  // OptionEditor), converte FoodSearchResult → ItemDraftFood e
  // adiciona o item com a quantidade default do food (mesmo
  // comportamento do AddFoodQuantityStep da Fase 4 quando abre
  // direto na sub-view de quantidade).
  const handleAddItem = (optionId: string, food: FoodSearchResult) => {
    const itemFood = foodSearchResultToItemFood(food)
    addItem(optionId, itemFood, Math.round(food.default_serving_g))
  }

  const isActive = original?.plan.is_active ?? false
  const saving = savePlan.isPending || activatePlan.isPending

  const handleSave = async () => {
    if (!draft || !original) return
    try {
      await savePlan.mutateAsync({ planId, original, draft })
      // Reset → useEffect re-hidrata o draft do query.data fresco.
      // Ids reais aparecem nos itens que eram drafts antes.
      resetDraft()

      if (isActive) {
        // Ressincroniza o diário de hoje. RPC é idempotente e preserva
        // log_meals com entries (vide body em §2 do STATUS).
        try {
          await activatePlan.mutateAsync(planId)
          toast.success('Plano salvo e sincronizado com hoje.')
        } catch (activateErr) {
          // Save deu certo, ressync falhou — avisar mas não bloquear.
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
        // Mostra só o primeiro problema — user corrige um por um. O
        // .issues completo fica disponível pra debug se precisar.
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

      {/* Aviso pra dar contexto: edições só vão pro banco no Salvar. */}
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
          {/* Nome do plano (editável inline). onChange já sincroniza com
              draft — sem debounce porque é estado local barato. */}
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
                    onAddSlot={() => addSlot(meal.id)}
                    onUpdateSlotLabel={(slotId, label) =>
                      updateSlot(slotId, { label })
                    }
                    onRemoveSlot={removeSlot}
                    onAddOption={addOption}
                    onRemoveOption={removeOption}
                    onAddItem={handleAddItem}
                    onUpdateItemQty={(itemId, qty) =>
                      updateItem(itemId, { quantity_g: qty })
                    }
                    onRemoveItem={removeItem}
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
