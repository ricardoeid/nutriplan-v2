import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Settings } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { getNowMinutesBR, getTodayBR } from '@/lib/dates'
import { useAddEntries } from '@/features/log/hooks/use-add-entries'
import { useDailyLog } from '@/features/log/hooks/use-daily-log'

import { useTodaysPlan } from '../hooks/use-todays-plan'
import {
  useSetAdjustment,
  useClearAdjustment,
  type SetAdjustmentInput,
} from '../hooks/use-day-adjustments'
import { ProximaRefeicaoCard } from '../components/proxima-refeicao-card'
import { RefeicaoCollapsedCard } from '../components/refeicao-collapsed-card'
import type { CommitSelectedSlot } from '../components/meal-commit-sheet'
import type { PlanTreeMealRaw } from '../lib/draft-types'
import { findNextMealId, timeToMinutes } from '../lib/meal-status'
import { SubstitutionFlow } from '@/features/substitution/components/substitution-flow'

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
// Fase 6 B3.5: "Abrir refeição" nos colapsados força destaque manual
//             (forcedNextMealId). Badge "Ajustado hoje".
// Fase 6 B3.6: ensureLogMealId on-demand (re-cria log_meal se user
//             deletou pela Home); badge "Ajustado hoje" só pra refeições
//             registradas com slots não cobertos (trocar alternativa
//             NÃO conta — alternativas são plano); reset forcedNextMealId
//             após registrar com sucesso.
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
    dailyLogId,
    today,
    loading,
    error,
  } = useTodaysPlan()

  // Daily log pra B6 (consumedSoFar do engine + dayTargets do snapshot).
  // TanStack Query cacheia — useDailyLog é o mesmo chamado internamente
  // por useTodaysPlan, então não duplica request.
  const todayISO = getTodayBR()
  const dailyLog = useDailyLog(todayISO)
  void todayISO // todayISO === today; usado apenas pra forçar consistência

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
  //
  // B3.6 — fix issue 2: se o user deletou a refeição inteira na Home,
  // a log_meal correspondente sumiu (não é recriada pelo
  // get_or_create_daily_log porque ele é idempotente no daily_log, não
  // resseed por meal). Aqui ensureLogMealId garante a row existindo
  // antes de inserir entries — re-cria se preciso.
  //
  // B3.6 — fix issue 3: ao registrar com sucesso, reseta o
  // forcedNextMealId. Refeição que foi "Abrir refeição"-da vira ✓
  // verde e desce pra fila das colapsadas (porque agora tem entries),
  // e a próxima automática por hora vira a destacada de novo.
  const handleRegisterRefeicao = async (
    planMeal: PlanTreeMealRaw,
    selectedSlots: CommitSelectedSlot[],
  ) => {
    if (!dailyLogId) {
      toast.error('Diário do dia ainda carregando. Tente em alguns segundos.')
      throw new Error('No dailyLogId yet')
    }
    try {
      const logMealId = await ensureLogMealId(planMeal, dailyLogId)
      const entries = selectedSlots.map((s) => ({
        mealId: logMealId,
        food: s.food,
        quantityG: s.quantityG,
        planSlotId: s.slotId,
        planOptionId: s.optionId,
        isOffPlan: false,
      }))
      await addEntries.mutateAsync({ entries, dateISO: today })
      toast.success('Refeição registrada')
      setForcedNextMealId(null)
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

  // Fase 6 B6: state do SubstitutionFlow. Quando aberto, renderiza
  // overlay de sheets sobre o /plano. Fechar = cancelar (nada persiste).
  const [substitutionFlowOpen, setSubstitutionFlowOpen] = useState(false)

  // plan_meal da próxima (alvo da substituição quando user clica
  // "Quero comer outra coisa")
  const targetPlanMeal = useMemo(() => {
    if (!nextMealId || !planTree) return null
    return planTree.meals.find((m) => m.id === nextMealId) ?? null
  }, [nextMealId, planTree])

  // Refeições futuras (cronológica > target + sem entries hoje).
  // Engine propaga excesso só pras que estão "à frente" do target e
  // ainda não foram registradas.
  const futurePlanMeals = useMemo(() => {
    if (!targetPlanMeal || !planTree) return []
    const targetMinutes = timeToMinutes(targetPlanMeal.target_time)
    return planTree.meals.filter((m) => {
      if (m.id === targetPlanMeal.id) return false
      const entries = entriesByPlanMealId.get(m.id) ?? []
      if (entries.length > 0) return false
      // Sem target_time fica no fim — não é "futura" estritamente.
      const mealMinutes = timeToMinutes(m.target_time)
      if (mealMinutes === null || targetMinutes === null) return false
      return mealMinutes > targetMinutes
    })
  }, [targetPlanMeal, planTree, entriesByPlanMealId])

  // Set<plan_meal_id> de refeições "ajustadas hoje". Disparam o badge
  // "Ajustado hoje". Trocar alternativa via B2 NÃO conta (alternativas
  // são plano).
  //
  // Disparos:
  //   1. Refeição REGISTRADA (entries.length > 0) com algum slot do
  //      plano NÃO coberto por entries (user desmarcou no commit sheet)
  //   2. Refeição com alguma entry off-plan (B6 — "Quero comer outra
  //      coisa" com food novo)
  //   3. Refeição com plan_day_adjustments cuja qty DIFERE da option
  //      cadastrada no plano (B6 — propagação alterou qty pra preservar
  //      o dia; ou refeição-alvo com items zerados que viraram adjustment)
  //
  // Caso #3 é a chave pra diferenciar troca de alternativa (B2 — qty =
  // cadastrada) de propagação/substituição (B6 — qty alterada).
  const mealsAdjustedToday = useMemo(() => {
    if (!planTree) return new Set<string>()
    const set = new Set<string>()

    // Map auxiliar: option_id → qty cadastrada no plano (pra comparar
    // contra adjusted_quantity_g).
    const cadastradaQtyByOptionId = new Map<string, number>()
    const mealIdByOptionId = new Map<string, string>()
    for (const meal of planTree.meals) {
      for (const slot of meal.slots) {
        for (const opt of slot.options) {
          const qty = Number(opt.items[0]?.quantity_g ?? 0)
          cadastradaQtyByOptionId.set(opt.id, qty)
          mealIdByOptionId.set(opt.id, meal.id)
        }
      }
    }

    for (const meal of planTree.meals) {
      const entries = entriesByPlanMealId.get(meal.id) ?? []

      // Disparo 1 e 2: entries
      if (entries.length > 0) {
        const coveredSlots = new Set(
          entries
            .map((e) => e.plan_slot_id)
            .filter((id): id is string => id !== null),
        )
        const hasUncoveredSlot = meal.slots.some(
          (slot) => !coveredSlots.has(slot.id),
        )
        const hasOffPlanEntry = entries.some((e) => e.is_off_plan === true)
        if (hasUncoveredSlot || hasOffPlanEntry) {
          set.add(meal.id)
          continue
        }
      }
    }

    // Disparo 3: adjustments com qty diferente da cadastrada
    for (const adj of adjustmentsBySlotId.values()) {
      const mealId = mealIdByOptionId.get(adj.plan_option_id)
      if (!mealId) continue
      const cadastrada = cadastradaQtyByOptionId.get(adj.plan_option_id)
      if (cadastrada === undefined) continue
      const adjustedQty = Number(adj.adjusted_quantity_g)
      if (Math.abs(adjustedQty - cadastrada) > 0.01) {
        set.add(mealId)
      }
    }

    return set
  }, [planTree, entriesByPlanMealId, adjustmentsBySlotId])

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
                      onRegisterRefeicao={handleRegisterRefeicao}
                      registering={addEntries.isPending}
                      hasAdjustments={mealsAdjustedToday.has(meal.id)}
                      onAbrirSubstituicao={
                        dailyLogId
                          ? () => setSubstitutionFlowOpen(true)
                          : undefined
                      }
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
                      hasAdjustments={mealsAdjustedToday.has(meal.id)}
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
                      hasAdjustments={mealsAdjustedToday.has(meal.id)}
                      onAbrirRefeicao={() => setForcedNextMealId(meal.id)}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {/* Fase 6 B6: SubstitutionFlow renderizado em overlay. State no
          parent pra que abrir/fechar não desmonte os sheets a cada
          re-render do card. */}
      {substitutionFlowOpen &&
        targetPlanMeal &&
        planTree &&
        dailyLogId &&
        logMealIdByPlanMealId.get(targetPlanMeal.id) && (
          <SubstitutionFlow
            open={substitutionFlowOpen}
            onOpenChange={setSubstitutionFlowOpen}
            planId={planTree.plan.id}
            todayISO={today}
            dayTargets={{
              kcal: Number(dailyLog.dailyLog?.calorie_target_snapshot ?? 0),
              protein: Number(dailyLog.dailyLog?.protein_target_snapshot ?? 0),
              carbs: Number(dailyLog.dailyLog?.carb_target_snapshot ?? 0),
              fat: Number(dailyLog.dailyLog?.fat_target_snapshot ?? 0),
            }}
            dailyLogId={dailyLogId}
            targetLogMealId={logMealIdByPlanMealId.get(targetPlanMeal.id)!}
            targetPlanMeal={targetPlanMeal}
            futurePlanMeals={futurePlanMeals}
            adjustmentsBySlotId={adjustmentsBySlotId}
            dailyLogMeals={dailyLog.meals}
          />
        )}
    </div>
  )
}

// Garante que existe uma log_meal pra esta plan_meal no daily_log de
// hoje. Retorna o id da log_meal — existente ou recém-criada.
//
// Use case (B3.6): user registrou refeição → log_meal criada com
// plan_meal_id. User foi pra Home e deletou a refeição inteira
// (DELETE em log_meals). Voltou pra /plano e tentou registrar de
// novo — sem essa função, o botão fica disabled porque
// logMealIdByPlanMealId não tem entry pra esse plan_meal_id.
//
// activate_meal_plan re-seedaria mas não roda em fluxo normal de uso
// (só na ativação do plano). get_or_create_daily_log é idempotente no
// daily_log, não resseed por meal. Esta função é o gancho cirúrgico.
//
// Não-atômico (SELECT + INSERT separados). Single-user single-tab não
// tem race; se virar problema, viramos RPC SECURITY DEFINER no banco.
async function ensureLogMealId(
  planMeal: PlanTreeMealRaw,
  dailyLogId: string,
): Promise<string> {
  const { data: existing, error: selError } = await supabase
    .from('log_meals')
    .select('id')
    .eq('daily_log_id', dailyLogId)
    .eq('plan_meal_id', planMeal.id)
    .maybeSingle()
  if (selError) throw selError
  if (existing) return existing.id

  const { data: created, error: insError } = await supabase
    .from('log_meals')
    .insert({
      daily_log_id: dailyLogId,
      plan_meal_id: planMeal.id,
      name: planMeal.name,
      sort_order: planMeal.sort_order,
      target_time: planMeal.target_time,
    })
    .select('id')
    .single()
  if (insError) throw insError
  return created.id
}
