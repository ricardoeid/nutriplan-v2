-- Fase 2 / Bloco 8.5
-- Fix: weight_logs.logged_on usava CURRENT_DATE (UTC), causando off-by-one
-- pra usuários do BR que registram peso após 21h BRT — exatamente o
-- horário do jantar / pesagem antes de dormir.
--
-- Solução: trocar default pra (now() AT TIME ZONE 'America/Sao_Paulo')::date.
-- Hardcoda fuso BR — aceitável enquanto app é pro mercado brasileiro.
-- Quando internacionalizar, refator passa pra coluna `timezone` no profile.
--
-- Tipo da coluna NÃO muda (continua date). Apenas o default. Rows
-- existentes ficam intactas. Não regenera tipos do TS (defaults não
-- aparecem em src/types/database.ts).

ALTER TABLE weight_logs
  ALTER COLUMN logged_on
  SET DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date);
