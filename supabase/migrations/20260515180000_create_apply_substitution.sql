-- apply_substitution: RPC atômica pra commit de "Quero comer outra coisa".
--
-- Recebe payload jsonb estruturado pelo client (B6) com:
--   - log_meal_id: refeição-alvo no daily_log
--   - adjustment_date: data BR (YYYY-MM-DD)
--   - plan_id, plan_meal_id: contexto pro adjustment
--   - target_entries: entries pra inserir em log_entries da refeição-alvo
--     (inclui o chosen com is_off_plan=true + items ajustados não-zerados
--     com is_off_plan=false)
--   - target_adjustments: TODOS os items originais da refeição-alvo
--     (zerados ou ajustados — replace por slot)
--   - future_adjustments: items das refeições futuras afetadas pela
--     propagação (qty nova)
--   - food_ids_to_bump: foods envolvidos pra atualizar user_food_prefs
--
-- Tudo em 1 transação SECURITY DEFINER. Failure no meio → rollback total.
-- Resolve atomicidade que o B6 client-side teria que orquestrar em 3-4
-- round-trips com risco de estado intermediário em rede mobile.
--
-- Workaround P22 (UNIQUE em option_item_id no plan_day_adjustments):
-- delete-then-insert por plan_meal_id antes do INSERT garante "1
-- adjustment por slot por dia" mesmo com o constraint sub-ótimo.

CREATE OR REPLACE FUNCTION public.apply_substitution(p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_log_meal_id uuid := (p_payload->>'log_meal_id')::uuid;
  v_adjustment_date date := (p_payload->>'adjustment_date')::date;
  v_plan_id uuid := (p_payload->>'plan_id')::uuid;
  v_target_plan_meal_id uuid := (p_payload->>'plan_meal_id')::uuid;
  v_entry jsonb;
  v_adjustment jsonb;
  v_food_id_text text;
  v_affected_meal_ids uuid[];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Coletar meal_ids afetados: target + futuras com adjustments propagados.
  v_affected_meal_ids := ARRAY[v_target_plan_meal_id];
  SELECT array_cat(
    v_affected_meal_ids,
    array_agg(DISTINCT (a->>'plan_meal_id')::uuid)
  )
  INTO v_affected_meal_ids
  FROM jsonb_array_elements(p_payload->'future_adjustments') a;

  -- 1. DELETE adjustments existentes das refeições afetadas no dia
  --    (replace semantics — workaround P22).
  DELETE FROM public.plan_day_adjustments
  WHERE user_id = v_user_id
    AND adjustment_date = v_adjustment_date
    AND plan_meal_id = ANY(v_affected_meal_ids);

  -- 2. INSERT target_adjustments (refeição-alvo: todos os items
  --    originais com qty 0 ou ajustada). Itens zerados ficam no banco
  --    pra registrar "este slot foi anulado pelo user no dia".
  FOR v_adjustment IN
    SELECT * FROM jsonb_array_elements(p_payload->'target_adjustments')
  LOOP
    INSERT INTO public.plan_day_adjustments (
      user_id, adjustment_date, plan_id, plan_meal_id,
      plan_slot_id, plan_option_id, option_item_id, adjusted_quantity_g
    ) VALUES (
      v_user_id, v_adjustment_date, v_plan_id, v_target_plan_meal_id,
      (v_adjustment->>'plan_slot_id')::uuid,
      (v_adjustment->>'plan_option_id')::uuid,
      (v_adjustment->>'option_item_id')::uuid,
      (v_adjustment->>'adjusted_quantity_g')::numeric
    );
  END LOOP;

  -- 3. INSERT future_adjustments (1 row por item afetado por refeição
  --    futura). Cada row tem plan_meal_id da SUA futura.
  FOR v_adjustment IN
    SELECT * FROM jsonb_array_elements(p_payload->'future_adjustments')
  LOOP
    INSERT INTO public.plan_day_adjustments (
      user_id, adjustment_date, plan_id, plan_meal_id,
      plan_slot_id, plan_option_id, option_item_id, adjusted_quantity_g
    ) VALUES (
      v_user_id, v_adjustment_date, v_plan_id,
      (v_adjustment->>'plan_meal_id')::uuid,
      (v_adjustment->>'plan_slot_id')::uuid,
      (v_adjustment->>'plan_option_id')::uuid,
      (v_adjustment->>'option_item_id')::uuid,
      (v_adjustment->>'adjusted_quantity_g')::numeric
    );
  END LOOP;

  -- 4. INSERT target_entries em log_entries.
  --    Caller envia entries que o user CONFIRMOU comer (descheckados
  --    são removidos no client antes de chamar). Cada entry tem
  --    snapshots de macros pré-computados (snapshot pattern §4).
  FOR v_entry IN
    SELECT * FROM jsonb_array_elements(p_payload->'target_entries')
  LOOP
    INSERT INTO public.log_entries (
      log_meal_id, food_id, quantity_g,
      kcal, protein, carbs, fat,
      plan_slot_id, plan_option_id, is_off_plan
    ) VALUES (
      v_log_meal_id,
      (v_entry->>'food_id')::uuid,
      (v_entry->>'quantity_g')::numeric,
      (v_entry->>'kcal')::numeric,
      (v_entry->>'protein')::numeric,
      (v_entry->>'carbs')::numeric,
      (v_entry->>'fat')::numeric,
      NULLIF(v_entry->>'plan_slot_id', '')::uuid,
      NULLIF(v_entry->>'plan_option_id', '')::uuid,
      COALESCE((v_entry->>'is_off_plan')::boolean, false)
    );
  END LOOP;

  -- 5. Bump user_food_prefs pra cada food_id distinto envolvido.
  --    Idêntico ao bump_food_use single, em loop. Atualizado em 1
  --    chamada SQL pra eficiência.
  FOR v_food_id_text IN
    SELECT jsonb_array_elements_text(p_payload->'food_ids_to_bump')
  LOOP
    INSERT INTO public.user_food_prefs (user_id, food_id, use_count, last_used)
    VALUES (v_user_id, v_food_id_text::uuid, 1, now())
    ON CONFLICT (user_id, food_id)
    DO UPDATE SET
      use_count = public.user_food_prefs.use_count + 1,
      last_used = now();
  END LOOP;
END
$function$;
