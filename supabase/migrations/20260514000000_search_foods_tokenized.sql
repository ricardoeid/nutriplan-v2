-- search_foods: tokeniza a query antes do filtro, pra permitir busca
-- multi-palavra em qualquer ordem.
--
-- Antes:
--   "pão integral" → ILIKE '%pão integral%' → não acha "Pão de forma integral"
--
-- Depois:
--   "pão integral" → tokens ["pão", "integral"] → cada token precisa aparecer
--   em algum lugar do name OR brand. Acha "Pão de forma integral".
--
-- O rank_score (trigram similarity) continua igual — ele empurra os matches
-- mais próximos da query original pro topo. Trigram não é usado mais no
-- filtro, só no ranking.
--
-- Mantém a mesma assinatura e todos os outros comportamentos:
--   - Filtros (taco, off, frequent, recent, favorites, mine, all)
--   - Exclusão de archived + hidden
--   - RLS (user_id = p_user_id OU user_id IS NULL pra globais)
--   - Bonus de cozidos/grelhados, penalidade de cru, etc.

CREATE OR REPLACE FUNCTION public.search_foods(
  p_user_id uuid,
  p_query text,
  p_filter text DEFAULT 'all'::text,
  p_limit integer DEFAULT 30
)
RETURNS TABLE(
  id uuid,
  name text,
  brand text,
  category text,
  source text,
  external_id text,
  kcal_per_100g numeric,
  protein_per_100g numeric,
  carb_per_100g numeric,
  fat_per_100g numeric,
  fiber_per_100g numeric,
  default_serving_g numeric,
  serving_label text,
  is_favorite boolean,
  use_count integer,
  last_used timestamp with time zone,
  is_composite boolean,
  recalc_whole_units_only boolean,
  rank_score numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
  SELECT
    f.id, f.name, f.brand, f.category, f.source, f.external_id,
    f.kcal_per_100g, f.protein_per_100g, f.carb_per_100g, f.fat_per_100g,
    f.fiber_per_100g, f.default_serving_g, f.serving_label,
    COALESCE(ufp.is_favorite, false) AS is_favorite,
    COALESCE(ufp.use_count, 0) AS use_count,
    ufp.last_used,
    (f.source = 'composite') AS is_composite,
    f.recalc_whole_units_only,
    (
      extensions.similarity(extensions.unaccent(f.name), extensions.unaccent(p_query)) * 10
      + CASE WHEN f.name ~* '(cozid|grelhad|assad|refogad|cozida|grelhada|assada|refogada)' THEN 2 ELSE 0 END
      - CASE WHEN f.name ~* '\mcru[as]?\M' THEN 2 ELSE 0 END
      + LEAST(COALESCE(ufp.use_count, 0), 20) * 0.5
      + CASE WHEN ufp.last_used > now() - interval '7 days' THEN 5 ELSE 0 END
      + CASE WHEN COALESCE(ufp.is_favorite, false) THEN 3 ELSE 0 END
      + CASE WHEN f.source = 'taco' THEN 1 ELSE 0 END
    )::numeric AS rank_score
  FROM public.foods f
  LEFT JOIN public.user_food_prefs ufp ON ufp.food_id = f.id AND ufp.user_id = p_user_id
  WHERE
    f.is_archived = false
    AND COALESCE(ufp.is_hidden, false) = false
    AND (f.user_id IS NULL OR f.user_id = p_user_id)
    AND (
      -- Query vazia: aceita tudo (mesmo comportamento de antes).
      p_query = ''
      OR
      -- Tokenização: TODOS os tokens da query precisam aparecer como
      -- substring no name OU no brand (case+accent insensitive).
      -- NOT EXISTS de "algum token NÃO bate" == "todos os tokens batem".
      NOT EXISTS (
        SELECT 1
        FROM unnest(
          regexp_split_to_array(trim(extensions.unaccent(p_query)), '\s+')
        ) AS token
        WHERE token <> ''
          AND NOT (
            extensions.unaccent(f.name) ILIKE '%' || token || '%'
            OR (f.brand IS NOT NULL AND extensions.unaccent(f.brand) ILIKE '%' || token || '%')
          )
      )
    )
    AND (
      CASE p_filter
        WHEN 'taco' THEN f.source = 'taco'
        WHEN 'off' THEN f.source = 'open_food_facts'
        WHEN 'frequent' THEN COALESCE(ufp.use_count, 0) > 0
        WHEN 'recent' THEN ufp.last_used IS NOT NULL
        WHEN 'favorites' THEN COALESCE(ufp.is_favorite, false) = true
        WHEN 'mine' THEN f.user_id = p_user_id
        WHEN 'all' THEN (f.source <> 'open_food_facts' OR COALESCE(ufp.use_count, 0) > 0)
        ELSE true
      END
    )
  ORDER BY rank_score DESC, f.name ASC
  LIMIT p_limit;
$function$;
