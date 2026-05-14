import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

import { useMealPlans } from '../hooks/use-meal-plans'
import { useActivatePlan } from '../hooks/use-activate-plan'
import { useDeletePlan } from '../hooks/use-delete-plan'
import type { MealPlan } from '../lib/types'

// Formata timestamptz ISO pra "13/05/2026" (display curto). Usar Intl
// direto porque dates.ts só lida com YYYY-MM-DD; created_at é ISO
// completo com hora e timezone.
function formatCreatedAt(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso))
}

export default function PlansPage() {
  const navigate = useNavigate()
  const { plans, loading, error } = useMealPlans()
  const activatePlan = useActivatePlan()
  const deletePlan = useDeletePlan()

  const handleActivate = (plan: MealPlan) => {
    activatePlan.mutate(plan.id, {
      onSuccess: () => toast.success(`"${plan.name}" ativado`),
      onError: (err) =>
        toast.error(
          err instanceof Error
            ? `Erro ao ativar: ${err.message}`
            : 'Erro ao ativar plano.',
        ),
    })
  }

  const handleDelete = (plan: MealPlan) => {
    // window.confirm é o padrão minimalista pra evitar shadcn AlertDialog
    // (não instalado no projeto — §3 padrão 10 do STATUS). Aceitável pra
    // ação destrutiva pouco frequente.
    const ok = window.confirm(
      `Excluir o plano "${plan.name}"? Esta ação é irreversível e remove todas as refeições, slots e opções do plano.`,
    )
    if (!ok) return
    deletePlan.mutate(plan.id, {
      onSuccess: () => toast.success(`"${plan.name}" excluído`),
      onError: (err) =>
        toast.error(
          err instanceof Error
            ? `Erro ao excluir: ${err.message}`
            : 'Erro ao excluir plano.',
        ),
    })
  }

  const activatingId =
    activatePlan.isPending && typeof activatePlan.variables === 'string'
      ? activatePlan.variables
      : null
  const deletingId =
    deletePlan.isPending && typeof deletePlan.variables === 'string'
      ? deletePlan.variables
      : null

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Meus planos</h1>
        {plans.length > 0 && (
          <Button
            size="sm"
            onClick={() => navigate('/planos/novo')}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            Novo plano
          </Button>
        )}
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      )}

      {error && !loading && (
        <p className="text-sm text-destructive">
          Erro ao carregar planos:{' '}
          {error instanceof Error ? error.message : String(error)}
        </p>
      )}

      {!loading && !error && plans.length === 0 && (
        <div className="rounded-xl border bg-card p-8 text-center">
          <h2 className="mb-2 text-lg font-medium">
            Você ainda não tem planos alimentares
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Crie seu primeiro plano pra estruturar suas refeições e ativá-lo no
            diário.
          </p>
          <Button onClick={() => navigate('/planos/novo')}>
            Criar primeiro plano
          </Button>
        </div>
      )}

      {!loading && plans.length > 0 && (
        <ul className="space-y-3">
          {plans.map((plan) => (
            <li
              key={plan.id}
              className="rounded-xl border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-medium">{plan.name}</h2>
                    {plan.is_active && (
                      <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        Ativo
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Criado em {formatCreatedAt(plan.created_at)}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {!plan.is_active && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleActivate(plan)}
                    disabled={activatingId === plan.id}
                  >
                    {activatingId === plan.id ? 'Ativando…' : 'Ativar'}
                  </Button>
                )}
                <Button asChild variant="outline" size="sm">
                  <Link to={`/planos/${plan.id}/editar`}>Editar</Link>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(plan)}
                  disabled={deletingId === plan.id}
                >
                  {deletingId === plan.id ? 'Excluindo…' : 'Excluir'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
