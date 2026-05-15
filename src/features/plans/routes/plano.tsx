import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Settings } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { getNowMinutesBR } from '@/lib/dates'
import {
  useAddEntries,
  type AddEntryItem,
} from '@/features/log/hooks/use-add-entries'

import { useTodaysPlan } from '../hooks/use-todays-plan'
import {
  useSetAdjustment,
  useClearAdjustment,
  type SetAdjustmentInput,
} from '../hooks/use-day-adjustments'
import { ProximaRefeicaoCard } from '../components/proxima-refeicao-card'
import { RefeicaoCollapsedCard } from '../components/refeicao-collapsed-card'
import { findNextMealId, timeToMinutes } from '../lib/meal-status'

// Rota /plano — visão do plano ativo aplicado a hoje.
//
// Fase 5 B6: lista readonly simples de PlanMealReadonly.
// Fase 6 B1: refatora pra destacar "próxima refeição" (card grande,
//            estilo Print V1) e colapsar as demais com estado visual
//            (✓ comida / ○ sem entries ou futura).
// Fase 6 B2: clicar em alternativa do expansível troca a ativa do slot
//            via plan_day_adjustments. Mutations vivem aqui no parent
//            (Regra 14 — caller pode desmontar entre dispatch e callback).
//
// Estados:
//   - loading: spinner
//   - error: mensagem
//   - sem plano ativo: empty-state com link pra /planos
//   - com plano ativo: sub-header "Plano ativo" sutil + cards (destaque +
//     colapsados ordenados por target_time)
//
// Fase 6 B3: "Registrar esta refeição" → MealCommitSheet (renderizado
//            pelo ProximaRefeicaoCard) com checkboxes pré-marcados,
//            user desmarca o que não vai comer, batch insert via
//            useAddEntries (mutation no parent — Regra 14).
//
// Out of scope (próximos blocos):
//   - Esperado vs Comido no MealCard da Home (B4)
//   - Motor de substituição protein-aware (B5)
//   - "Quero comer outra coisa" sheet (B6)
export default function PlanoPage() {
  const {
    planTree,
    hasActivePlan,
    entriesByPlanMealId,
    logMealIdByPlanMealId,
    adjustmentsBySlotId,
    today,
    loading,
    error,
  } = useTodaysPlan()

  // Mutations no parent (Regra 14). Mesmo o caller (ProximaRefeicaoCard)
  // não sendo destruído ao trocar alternativa, mantemos o padrão por
  // simetria com a feature toda.
  const setAdjustment = useSetAdjustment()
  const clearAdjustment = useClearAdjustment()
  const addEntries = useAddEntries()

  const handleChangeAlternativa = (input: SetAdjustmentInput) => {
    setAdjustment.mutate(input)
  }

  const handleResetAlternativa = (slotId: string) => {
    clearAdjustment.mutate({ dateISO: today, plan_slot_id: slotId })
  }

  // Async pra que o card consiga await + fechar o sheet em sucesso.
  // Erro: toast + throw — card mantém sheet aberto pro user tentar
  // de novo.
  const handleRegisterRefeicao = async (entries: AddEntryItem[]) => {
    try {
      await addEntries.mutateAsync({ entries, dateISO: today })
      toast.success('Refeição registrada')
    } catch (err) {
      toast.error('Falha ao registrar refeição. Tente novamente.')
      throw err
    }
  }

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

  // Hora atual BR + próxima refeição derivadas no render. Não precisa
  // ser reativo a cada minuto — refresh natural quando o user voltar à
  // tab já recalcula. Se virar problema (UI grudada em "próxima" errada
  // por horas), B1.5 adiciona setInterval de 60s.
  const nowMinutes = useMemo(() => getNowMinutesBR(), [])
  const autoNextMealId = useMemo(
    () =>
      findNextMealId(
        sortedMeals.map((m) => ({
          id: m.id,
          target_time: m.target_time,
          sort_order: m.sort_order,
          hasEntries: (entriesByPlanMealId.get(m.id) ?? []).length > 0,
        })),
        nowMinutes,
      ),
    [sortedMeals, entriesByPlanMealId, nowMinutes],
  )

  // Override manual: user clicou "Abrir refeição" em algum card
  // colapsado pra ver/registrar/etc. Persiste só client-side — refresh
  // volta pro automático. (Decisão Ricardo 2026-05-15: simples, sem
  // controle de "voltar pro auto".)
  const [forcedNextMealId, setForcedNextMealId] = useState<string | null>(
    null,
  )
  const nextMealId = forcedNextMealId ?? autoNextMealId

  // Set<plan_meal_id> de refeições que têm pelo menos 1 adjustment ativo
  // hoje — usado pra exibir badge "Ajustado hoje" tanto na destacada
  // quanto nas colapsadas. Construído via map auxiliar slot_id → meal_id
  // (que vem do planTree) cruzado com os adjustments do dia.
  const mealsWithAdjustments = useMemo(() => {
    if (!planTree) return new Set<string>()
    const mealIdBySlotId = new Map<string, string>()
    for (const meal of planTree.meals) {
      for (const slot of meal.slots) {
        mealIdBySlotId.set(slot.id, meal.id)
      }
    }
    const set = new Set<string>()
    for (const adj of adjustmentsBySlotId.values()) {
      const mealId = mealIdBySlotId.get(adj.plan_slot_id)
      if (mealId) set.add(mealId)
    }
    return set
  }, [planTree, adjustmentsBySlotId])

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Plano de hoje</h1>
          {hasActivePlan && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Plano ativo
            </p>
          )}
        </div>
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
            // Layout em 3 zonas (B1):
            //   1. Destacada (PRÓXIMA REFEIÇÃO) sempre no topo
            //   2. Não-comidas em ordem cronológica (○)
            //   3. Comidas (✓) no fim em ordem cronológica
            // sortedMeals já está em target_time ASC; aqui só separamos em
            // 3 buckets mantendo a ordem interna.
            <ul className="space-y-3">
              {sortedMeals.map((meal) => {
                if (meal.id !== nextMealId) return null
                return (
                  <li key={meal.id}>
                    <ProximaRefeicaoCard
                      meal={meal}
                      planId={planTree.plan.id}
                      todayISO={today}
                      adjustmentsBySlotId={adjustmentsBySlotId}
                      onChangeAlternativa={handleChangeAlternativa}
                      onResetAlternativa={handleResetAlternativa}
                      logMealId={logMealIdByPlanMealId.get(meal.id) ?? null}
                      onRegisterRefeicao={handleRegisterRefeicao}
                      registering={addEntries.isPending}
                      hasAdjustments={mealsWithAdjustments.has(meal.id)}
                    />
                  </li>
                )
              })}

              {sortedMeals.map((meal) => {
                if (meal.id === nextMealId) return null
                const entries = entriesByPlanMealId.get(meal.id) ?? []
                if (entries.length > 0) return null
                const mm = timeToMinutes(meal.target_time)
                const status: 'past-empty' | 'future' =
                  mm !== null && nowMinutes > mm ? 'past-empty' : 'future'
                return (
                  <li key={meal.id}>
                    <RefeicaoCollapsedCard
                      meal={meal}
                      status={status}
                      entries={[]}
                      adjustmentsBySlotId={adjustmentsBySlotId}
                      hasAdjustments={mealsWithAdjustments.has(meal.id)}
                      onAbrirRefeicao={() => setForcedNextMealId(meal.id)}
                    />
                  </li>
                )
              })}

              {sortedMeals.map((meal) => {
                if (meal.id === nextMealId) return null
                const entries = entriesByPlanMealId.get(meal.id) ?? []
                if (entries.length === 0) return null
                return (
                  <li key={meal.id}>
                    <RefeicaoCollapsedCard
                      meal={meal}
                      status="past-eaten"
                      entries={entries}
                      adjustmentsBySlotId={adjustmentsBySlotId}
                      hasAdjustments={mealsWithAdjustments.has(meal.id)}
                      onAbrirRefeicao={() => setForcedNextMealId(meal.id)}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
