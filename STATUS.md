# NutriPlan V2 — STATUS

Última atualização: 2026-05-03 (fim da Fase 0)

Este arquivo é o resumo do estado atual do projeto. Serve como ponto
de retomada quando você (ou outro turn de IA) precisar entender onde
estamos sem reler todo o histórico de conversas.

---

## Fase 0 — FECHADA ✅

End-to-end vivo: GitHub → Vercel → Vite bundle → React → Supabase
client tipado → query real → 608 alimentos renderizados em produção.

### Backend (Supabase próprio)

- Projeto Supabase próprio, criado em `2026-05-02`, região São Paulo
- Migração feita a partir de Lovable Cloud (V1) — 16 migrations aplicadas
  via `supabase db push`, 1 migration de "Plano Teste" descartada por
  conter UUIDs hardcoded
- 14 tabelas no schema `public`:
  `composite_food_items`, `daily_logs`, `foods`, `log_entries`,
  `log_meals`, `meal_plans`, `option_items`, `plan_day_adjustments`,
  `plan_meals`, `plan_slots`, `profiles`, `slot_options`,
  `user_food_prefs`, `weight_logs`
- 16 funções/RPCs migradas:
  `activate_meal_plan`, `cleanup_plan_day_adjustments_on_entry_delete`,
  `cleanup_plan_day_adjustments_on_meal_delete`, `get_daily_log_owner`,
  `get_food_owner`, `get_log_meal_owner`, `get_meal_plan_owner`,
  `get_or_create_daily_log`, `get_plan_meal_owner`, `get_plan_slot_owner`,
  `get_plan_tree`, `get_slot_option_owner`, `handle_new_user`,
  `search_foods`, `search_unused_cached_off`, `update_updated_at_column`
- RLS ativo em todas as tabelas
- Tabela `foods` populada via CSV import (615 → 608 após cleanup):
  - 591 alimentos TACO
  - 11 curações de `default_serving_g` (ovo 50g, pão francês 50g,
    banana prata 80g, etc.)
  - 0 alimentos OFF cacheados
  - 0 composites
- FK `foods.user_id → auth.users(id) ON DELETE CASCADE` recriada
  conforme original

### Frontend (repo `nutriplan-v2`)

- Stack: Vite + React 18 + TypeScript + Tailwind v3 + shadcn/ui classic
- Path alias `@/` apontando pra `./src` (configurado em
  `vite.config.ts` + `tsconfig.json` + `tsconfig.app.json`)
- Tailwind v3 com paleta HSL (variáveis CSS em `:root` e `.dark`)
- shadcn/ui em modo manual: components em `src/components/ui/` são
  cópias diretas do site `ui.shadcn.com` (tab "Default")
- Atualmente só `Button` está criado (`@radix-ui/react-slot` instalado)
- Supabase client em `src/lib/supabase.ts` com generic `<Database>`,
  tipos gerados em `src/types/database.ts`
- Env vars em `.env.local` (gitignored): `VITE_SUPABASE_URL` e
  `VITE_SUPABASE_ANON_KEY`

### Infra

- GitHub: `github.com/ricardoeid/nutriplan-v2` (privado)
- Vercel: deploy automático em cada push pra `main`
- URL pública renderizando "608 alimentos cadastrados"

### Histórico de commits da Fase 0

1. `chore: bootstrap Vite + deps core`
2. `chore: setup tailwind v3 + shadcn classic + path alias`
3. `feat: supabase client + smoke test (608 foods)`
4. `feat: typed supabase client (Database generic)`
5. `fix: ignore tsconfig baseUrl deprecation for ts6 build`

---

## Decisões importantes tomadas

### Migração V1 → V2

- **Profiles e todos os dados user-scoped descartados** durante
  migração. V1 tinha 8 profiles de teste, todos seus. Decidimos não
  trazer pra V2. Consequência: `meal_plans`, `daily_logs`,
  `weight_logs`, etc. estão vazias no V2. Você vai criar dados novos
  do zero quando Auth estiver pronto na Fase 1.
- **Lovable Cloud V1 mantido intacto** como backup. NÃO mexer nele
  até validação completa do V2 estar feita.

### Stack frontend

- **Tailwind v3 (não v4)**: v4 mudou setup completamente. v3 é estável,
  shadcn classic funciona perfeitamente nela.
- **React Router v6 (não v7)**: v7 mexeu na API. v6 é o que documentação
  shadcn e tutoriais assumem.
- **shadcn manual (não CLI)**: o CLI atual (`shadcn@latest`) caiu em
  preset experimental "base-nova" que usa `@base-ui/react`, paleta
  oklch e dependências exóticas. CLI antigo (`shadcn-ui@0.8.0`) tem
  registry quebrado. Solução: copiar componentes do site oficial.

### Schema management

- **Schema vai evoluir via dashboard Supabase**, não via migrations
  versionadas neste repo. As migrations originais ficaram no repo V1
  (`comunidade-brasil-criativa`).
- **Após qualquer mudança de schema**, rodar:
  `bunx supabase gen types typescript --linked > src/types/database.ts`
  pra resincronizar tipos no client.

---

## Pendências conhecidas

### Item A — Despublicar Lovable Cloud V1 (futuro)

Quando V2 estiver com paridade funcional + dados reais migrados +
testado em produção, despublicar/deletar projeto Lovable original.
Por enquanto, mantém como backup.

### Item B — Curações: 11 vs 13

Blueprint original mencionava 13 curações de `default_serving_g`.
No banco V2 vieram 11. Diferença pequena, cobre o essencial. Se durante
uso aparecer alimento óbvio com `default_serving_g = 100` que deveria
ter unidade natural, ajustar via UPDATE pontual no SQL Editor.

### Item C — RLS de tabelas user-scoped não testada ainda

Smoke test de Fase 0 usou `count` em `foods` (que tem RLS permissiva
pra leitura anônima de dados globais). RLS de `profiles`, `daily_logs`,
`meal_plans`, etc. só vai ser exercitada quando Auth entrar (Fase 1).
Provável ser ok porque migrations vieram intactas, mas não validado.

### Item D — supabase/.temp/ regenera

`.gitignore` segura, mas se aparecer em `git status` algum dia, é
cache do Supabase CLI sendo regenerado. Comportamento esperado.

---

## Lições aprendidas (pra futuras fases)

1. **Build da Vercel é mais estrito que `bun dev` local.** TypeScript
   versions diferem. Hábito: rodar `bun run build` localmente antes de
   push grande pra pegar erros antes do deploy quebrar.

2. **Excel no Windows exibe UTF-8 sem BOM como Latin-1**, mostrando
   "Pão" como "PÃ£o". Isso é só visualização — arquivo está íntegro.
   Confirmar abrindo no Notepad.

3. **CSV do Supabase usa `;` como separador**, não vírgula. Vírgulas
   no meio de nomes ("Arroz, integral, cru") não são separadores.

4. **shadcn CLI atual está em transição** (classic → nova/base-ui).
   Para projetos novos hoje, copiar manualmente do site é mais seguro.

---

## Próximas fases (do blueprint)

### Fase 1 — Auth + roteamento + provider

- TanStack Query provider em `main.tsx`
- React Router com rotas `/login`, `/signup`, `/dashboard`
- Página Auth com RHF + zod
- Hook `useAuth` lendo session do Supabase
- Trigger `handle_new_user` cria row em `profiles` automaticamente

### Fase 2 — Onboarding + Profile

- Form multi-step de onboarding (sexo, idade, altura, peso, atividade,
  goal kcal/macros)
- Cálculo de BMR/TDEE
- Persistência em `profiles`

### Fase 3 — Banco de alimentos + busca

- Página de busca usando RPC `search_foods`
- Cache de OFF (Open Food Facts) sob demanda
- UI pra criar custom foods

### Fases 4+ — Planos, daily logs, etc.

(ver blueprint completo para detalhamento)
