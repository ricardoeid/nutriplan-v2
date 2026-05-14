import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { usePlanEditor } from '../hooks/use-plan-editor'
import { MealEditorCard } from '../components/meal-editor-card'
import { compareMealsByTime } from '../lib/draft-types'

// Editor de plano alimentar.
//
// B3: layout esqueleto + edição de refeições (nome + horário + remoção).
//     SEM SAVE — alterações vivem só no estado do React (PlanEditorState
//     dentro de usePlanEditor). Reload da página descarta tudo e re-busca
//     do banco. Banner explícito avisa o user.
//
// B4 vai popular o corpo expandido dos MealEditorCard com slots →
//   options → items + picker de food.
//
// B5 vai adicionar:
//   - Botão "Salvar" no header
//   - Hook useSavePlan com diff FK-safe
//   - Toast condicional se plano ativo (ressincroniza diário de hoje)
//   - Bloqueio visual / confirm se há mudanças não salvas e user tenta sair
//
// Ordenação das refeições: auto por target_time crescente (null vai pro
// fim). Decisão de UX da Fase 5. Implementação em compareMealsByTime.
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
    loading,
    error,
    notFound,
    setPlanName,
    addMeal,
    removeMeal,
    updateMeal,
  } = usePlanEditor(planId)

  // Ordenação visual aplicada na hora do render. Não muta o draft —
  // sort_order continua sendo a ordem de adição até o B5 normalizar.
  const sortedMeals = useMemo(() => {
    if (!draft) return []
    return [...draft.meals].sort(compareMealsByTime)
  }, [draft])

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Voltar">
          <Link to="/planos">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Editor de plano</h1>
      </div>

      {/* Aviso de modo preview — sai no B5. */}
      <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <strong>Modo preview.</strong> As alterações ainda não são salvas no
          servidor — o botão de salvar chega no próximo bloco. Recarregar a
          página descarta o rascunho.
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
                  />
                ))}
              </ul>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={addMeal}
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
