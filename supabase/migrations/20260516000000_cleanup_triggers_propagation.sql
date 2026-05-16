-- Atualiza as 2 triggers cleanup pra também limpar adjustments propagados
-- por substituição (B6 da Fase 6) ao deletar entries off-plan ou
-- log_meals do plano.
--
-- Problema reportado por Ricardo:
-- 1. User faz "Quero comer outra coisa" no Almoço → engine cria
--    adjustments no Almoço (target) + Jantar (propagação).
-- 2. User vai pra Home e deleta o Almoço inteiro.
-- 3. Trigger atual limpa adjustments do plan_meal_id do Almoço apenas.
--    Jantar continua com qty propagada (errada) → "Esperado plano" no
--    /plano e Home permanece bagunçado até user mexer manualmente.
--
-- Fix: estender as 2 triggers cleanup pra também deletar adjustments
-- em OUTROS plan_meals do mesmo dia/user QUE TENHAM qty diferente da
-- cadastrada na option (= adjustments do engine, não trocas de
-- alternativa do B2).
--
-- Distingue B2 (troca alternativa — qty == option.quantity_g, preserva)
-- de B6 (propagação/substituição — qty ≠ option.quantity_g, remove).

CREATE OR REPLACE FUNCTION public.cleanup_plan_day_adjustments_on_entry_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_plan_meal_id uuid;
  v_log_date date;
  v_user_id uuid;
BEGIN
  IF OLD.is_off_plan IS NOT TRUE THEN
    RETURN OLD;
  END IF;

  SELECT lm.plan_meal_id, dl.log_date, dl.user_id
    INTO v_plan_meal_id, v_log_date, v_user_id
  FROM public.log_meals lm
  JOIN public.daily_logs dl ON dl.id = lm.daily_log_id
  WHERE lm.id = OLD.log_meal_id;

  IF v_plan_meal_id IS NULL OR v_log_date IS NULL OR v_user_id IS NULL THEN
    RETURN OLD;
  END IF;

  -- Comportamento original: limpa TODOS os adjustments do plan_meal-alvo
  -- (a refeição cuja entry off-plan foi deletada).
  DELETE FROM public.plan_day_adjustments
  WHERE plan_meal_id = v_plan_meal_id
    AND adjustment_date = v_log_date
    AND user_id = v_user_id;

  -- Novo (B6.1): limpa também adjustments propagados em OUTROS plan_meals
  -- do MESMO DIA. Heurística: qty diferente da cadastrada na option =
  -- ajuste do engine, não troca de alternativa. Trocas (qty == cadastrada)
  -- ficam intactas — alternativas SÃO o plano.
  DELETE FROM public.plan_day_adjustments pda
  USING public.option_items oi
  WHERE pda.user_id = v_user_id
    AND pda.adjustment_date = v_log_date
    AND pda.plan_meal_id <> v_plan_meal_id
    AND oi.id = pda.option_item_id
    AND oi.quantity_g <> pda.adjusted_quantity_g;

  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_plan_day_adjustments_on_meal_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_log_date date;
  v_user_id uuid;
BEGIN
  IF OLD.plan_meal_id IS NULL THEN
    RETURN OLD;
  END IF;

  SELECT log_date, user_id INTO v_log_date, v_user_id
  FROM public.daily_logs WHERE id = OLD.daily_log_id;

  IF v_log_date IS NULL OR v_user_id IS NULL THEN
    RETURN OLD;
  END IF;

  -- Comportamento original: limpa adjustments do plan_meal cuja log_meal
  -- foi deletada.
  DELETE FROM public.plan_day_adjustments
  WHERE plan_meal_id = OLD.plan_meal_id
    AND adjustment_date = v_log_date
    AND user_id = v_user_id;

  -- Novo (B6.1): limpa propagados em OUTROS plan_meals (mesma heurística
  -- que entry_delete). User deletou a refeição inteira → presume que
  -- também quer reverter os ajustes propagados.
  DELETE FROM public.plan_day_adjustments pda
  USING public.option_items oi
  WHERE pda.user_id = v_user_id
    AND pda.adjustment_date = v_log_date
    AND pda.plan_meal_id <> OLD.plan_meal_id
    AND oi.id = pda.option_item_id
    AND oi.quantity_g <> pda.adjusted_quantity_g;

  RETURN OLD;
END;
$function$;
