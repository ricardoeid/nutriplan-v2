-- bump_food_use: incrementa contador de uso por (user, food) via upsert.
--
-- Resolve P12 do STATUS: filtros "Frequentes" e "Recentes" em /foods
-- liam de user_food_prefs.use_count + last_used, mas nenhuma mutation
-- de log_entries atualizava essas colunas — então os filtros ficavam
-- estáticos pra alimentos que o user só logou. Esta RPC é chamada de
-- TODA mutation que insere log_entries (useAddEntry, useAddEntries),
-- garantindo que cada uso "conte".
--
-- Idempotente via ON CONFLICT no UNIQUE (user_id, food_id) — já existia
-- na tabela desde o V1.
--
-- SECURITY DEFINER + auth.uid() ao invés de receber user_id: caller
-- (JS client) não pode forjar uid de outro usuário. Mesma estratégia
-- de outras RPCs do projeto.
--
-- Side effect bom: o ranking do search_foods (RPC da busca) tem bônus
-- pra use_count > 0 e last_used recente — sem bump_food_use rodando,
-- esse bônus era letra morta. Com bump rodando, a busca passa a
-- aprender hábitos do user organicamente.

CREATE OR REPLACE FUNCTION public.bump_food_use(p_food_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.user_food_prefs (user_id, food_id, use_count, last_used)
  VALUES (v_user_id, p_food_id, 1, now())
  ON CONFLICT (user_id, food_id)
  DO UPDATE SET
    use_count = public.user_food_prefs.use_count + 1,
    last_used = now();
END
$function$;
