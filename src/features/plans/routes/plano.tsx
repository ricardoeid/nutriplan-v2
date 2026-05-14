import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Settings } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { useTodaysPlan } from '../hooks/use-todays-plan'
import { PlanMealReadonly } from '../components/plan-meal-readonly'

// Rota /plano — visão read-only do plano ativo aplicado a hoje (B6).
//
// Estados:
//   - loading: spinner
//   - error: mensagem
//   - sem plano ativo: empty-state "Você não tem plano ativo. [Ver meus
//     planos]" → /planos
//   - com plano ativo: header (nome do plano + link "Meus planos") +
//     lista de refeições ordenadas por target_time (mesma ordem do
//     editor)
//
// Substitui a rota placeholder antiga em src/features/plan/. Após
// validar, deletar `src/features/plan/` (pasta inteira).
//
// Out of scope (Fase 6+):
//   - 3-tier overlay (planejado vs comido vs ajustes pontuais)
//   - "Próxima refeição" destacada
//   - "Quero comer outra coisa" / substituição protein-aware
export default function PlanoPage() {
  const { planTree, hasActivePlan, loading, error } = useTodaysPlan()

  // Ordenação por target_time crescente. Refeições sem horário ficam
  // no fim, desempate por sort_order. Mesma lógica do plan-edit, mas
  // com tipo do RPC (target_time = 'HH:MM:SS' ou null).
  const sortedMeals = useMemo(() => {
    if (!planTree) return []
    return [...planTree.meals].sort((a, b) => {
      if (!a.target_time && !b.target_time) {
        return a.sort_order - b.sort_order
      }
      if (!a.target_time) return 1
      if (!b.target_time) return -1
      if (a.target_time === b.target_time) {
        return a.sort_order - b.sort_order
      }
      return a.target_time.localeCompare(b.target_time)
    })
  }, [planTree])

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Plano de hoje</h1>
        <Button
          asChild
          variant="ghost"
          size="icon"
          aria-label="Gerenciar planos"
          title="Gerenciar planos"
        >
          <Link to="/planos">
            <Settings className="h-5 w-5" />
          </Link>
        </Button>
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

      {!loading && !error && !hasActivePlan && (
        <div className="rounded-xl border bg-card p-8 text-center">
          <ClipboardList className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="mb-2 text-lg font-medium">
            Você não tem plano ativo
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Ative um plano existente ou crie um novo pra estruturar suas
            refeições do dia.
          </p>
          <Button asChild>
            <Link to="/planos">Ver meus planos</Link>
          </Button>
        </div>
      )}

      {!loading && !error && hasActivePlan && planTree && (
        <>
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Plano ativo</p>
            <p className="truncate text-base font-semibold">
              {planTree.plan.name}
            </p>
          </div>

          {sortedMeals.length === 0 ? (
            <p className="rounded-md border border-dashed bg-muted/40 p-4 text-center text-sm text-muted-foreground">
              O plano ativo ainda não tem refeições. Edite em{' '}
              <Link
                to={`/planos/${planTree.plan.id}/editar`}
                className="underline"
              >
                Meus planos
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-3">
              {sortedMeals.map((meal) => (
                <li key={meal.id}>
                  <PlanMealReadonly meal={meal} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
