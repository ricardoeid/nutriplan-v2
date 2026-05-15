-- activate_meal_plan: corrige o bug de timezone (P16).
--
-- Antes: usava `CURRENT_DATE` (UTC do servidor) pra encontrar o
-- daily_log de hoje. Entre 21:00-23:59 BR (= 00:00-02:59 UTC do dia
-- seguinte), o servidor "pensa que é amanhã":
--   - SELECT daily_log de amanhã → não encontra (não foi criado ainda)
--   - Bloco IF inteiro pulado
--   - daily_log real (do dia BR) fica com plan_id NULL
--   - log_meals continuam com defaults ("Café da manhã / Almoço / Jantar"),
--     nunca seedados das plan_meals do plano novo
--
-- Resultado prático: /plano mostra "Você não tem plano ativo" mesmo
-- quando /planos lista o plano com badge "Ativo" — desincronização
-- entre meal_plans.is_active (true) e daily_logs.plan_id (NULL).
--
-- Depois: usa `(now() AT TIME ZONE 'America/Sao_Paulo')::date` — mesma
-- estratégia da migration 20260506000000 (weight_logs.logged_on).
-- daily_log encontrado em qualquer hora BR, cleanup-and-seed roda sempre.
--
-- Estrutura idêntica ao original (mesma sequência de UPDATE/SELECT/
-- DELETE/INSERT). Single-line change na linha do SELECT.

CREATE OR REPLACE FUNCTION public.activate_meal_plan(p_plan_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_today_log_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM meal_plans WHERE id = p_plan_id AND user_id = v_user_id) THEN
    RAISE EXCEPTION 'Plan not found or not owned';
  END IF;

  UPDATE meal_plans SET is_active = false
  WHERE user_id = v_user_id AND is_active = true AND id <> p_plan_id;

  UPDATE meal_plans SET is_active = true WHERE id = p_plan_id;

  -- BR timezone (fix P16) — antes era CURRENT_DATE (UTC).
  SELECT id INTO v_today_log_id FROM public.daily_logs
  WHERE user_id = v_user_id
    AND log_date = (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  IF v_today_log_id IS NOT NULL THEN
    -- Remove empty log_meals that don't belong to the new plan (whether unlinked or from another plan)
    DELETE FROM public.log_meals lm
    WHERE lm.daily_log_id = v_today_log_id
      AND NOT EXISTS (
        SELECT 1 FROM public.log_entries le WHERE le.log_meal_id = lm.id
      )
      AND (
        lm.plan_meal_id IS NULL
        OR lm.plan_meal_id NOT IN (SELECT id FROM public.plan_meals WHERE plan_id = p_plan_id)
      );

    -- Seed missing plan meals
    INSERT INTO public.log_meals (daily_log_id, name, sort_order, plan_meal_id, target_time)
    SELECT v_today_log_id, pm.name, pm.sort_order, pm.id, pm.target_time
    FROM public.plan_meals pm
    WHERE pm.plan_id = p_plan_id
      AND NOT EXISTS (
        SELECT 1 FROM public.log_meals lm2
        WHERE lm2.daily_log_id = v_today_log_id AND lm2.plan_meal_id = pm.id
      );

    UPDATE public.daily_logs SET plan_id = p_plan_id WHERE id = v_today_log_id;
  END IF;
END
$function$;
