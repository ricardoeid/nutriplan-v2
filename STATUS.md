# NutriPlan V2 — STATUS

**Última atualização:** 2026-05-08 (fim da Fase 3 do projeto)
**Commit em prod:** `874b1be` — `feat(foods): hide foods with undo toast and profile section`
**Repo:** github.com/ricardoeid/nutriplan-v2 — Vercel deploy autom em `main`

Este arquivo é o ponto de retomada do projeto. Próximo chat lê isso, fecha
o arquivo, e começa a Fase 4 com contexto suficiente pra trabalhar sem
reler o histórico todo.

---

## 0. CONTEXTO DO PROJETO E DO USUÁRIO

### Sobre o Ricardo (usuário)

- **Solo dev.** Sem time, sem code review externo, sem QA.
- **Leigo em parte do stack.** Não conhece a fundo: zod, TanStack Query, RHF.
  Conhece bem: React, TS, conceitos gerais de banco.
- **Trabalha no Windows / PowerShell** em `C:\projetos\nutriplan-v2`.
- **Edita no Cursor** (algumas vezes outro editor — ignore).
- **Tem 2 contas de teste em prod:** `teste1@nutriplan.dev` e `teste2@nutriplan.dev`.
- **Estilo de trabalho:** pega entregas pequenas, valida manualmente, commita,
  segue. Não tolera retrabalho por chute do modelo.

### Sobre o projeto

NutriPlan é um app de planejamento e tracking alimentar. PWA. Mercado BR.
Foco em:
- Banco TACO (591 alimentos brasileiros) + custom foods + composite recipes
- Open Food Facts integrado (adiado — ver §10)
- Planos alimentares estruturados (Fase 5 do projeto)
- Motor de substituição protein-aware (Fase 6 do projeto)

V1 foi escrito no Lovable Cloud + TanStack Start. V2 é rewrite from scratch
no stack abaixo, com o mesmo banco Supabase migrado.

### Stack atual (NÃO MUDAR sem motivo forte)

```
Vite 8 + React 19 + TypeScript 6
Tailwind v3 + shadcn/ui classic
TanStack Query (estado server)
react-router-dom v6
react-hook-form 7 + zod 4 + @hookform/resolvers
sonner (toasts)
Supabase JS 2 (auth + DB + futuramente Edge Functions)
Bun (package manager + script runner)
```

shadcn primitivos instalados:
button, card, form, input, label, progress, radio-group, sonner.

**Nada de @radix-ui/react-dropdown-menu, @radix-ui/react-dialog, @radix-ui/react-sheet** —
quando precisarmos de dropdown/dialog/sheet, primeiro discutir custo-benefício
de instalar vs implementar manual. No B9 (hide menu) fizemos manual com sucesso.

---

## 1. REGRAS DE COLABORAÇÃO COM IA (LEIA ANTES DE QUALQUER COISA)

### Regra 1 — Entregar arquivos via download, NUNCA em bloco markdown grande

Blocos de código markdown podem **comer caracteres silenciosamente** em paste
longo — especialmente o `<` que abre generics em `React.forwardRef`. Custou
~10 turnos do Bloco 3 da Fase 1 investigando como se fosse encoding/tsconfig.

**Sempre usar `create_file` + `present_files`.** Comandos PowerShell pra mover:

```powershell
Move-Item -Force $HOME\Downloads\<arquivo> C:\projetos\nutriplan-v2\<destino>
```

Exceção: trechos curtos pra explicação conceitual (≤5 linhas, sem generics).

### Regra 2 — Entregas pequenas, validação manual rodável em 1-2 min

Quebrar tarefas em blocos curtos (B1, B2, ..., Bn). Cada bloco com critério
de validação manual antes do commit. Não amontoar.

**Validação por bloco** = `bun run build` + `bun run dev` + cenários
manuais específicos descritos pelo modelo. Ricardo testa, reporta, commita.

### Regra 3 — Erro de TS estranho? Suspeite de arquivo corrompido PRIMEIRO

Quando vier "Expression expected", "Operator > cannot be applied", JSX
elements sem closing tag em contexto não-JSX: **suspeite primeiro de
caractere faltando no arquivo gerado**. Pedir o arquivo, ler com calma.
Erros TS em cascata viram fantasmas absurdos depois do primeiro erro real.

### Regra 4 — Windows / PowerShell

- Ctrl+C **cancela comando** (não copia)
- Seleção com mouse + clique direito copia
- `Get-Content` mostra UTF-8 sem BOM como mojibake — arquivo está íntegro,
  é só visualização. Pra ler corretamente: `Get-Content <path> -Encoding UTF8`
- Pra outputs longos, Ricardo prefere `comando > resultado.txt` e anexar.

### Regra 5 — Aritmética: NUNCA calcular de cabeça

Pra qualquer número esperado de validação (BMR, TDEE, macros, conversões
g↔%, preview kcal/100g), gerar via `bash_tool` com Python ou rodando o
próprio código. Mental do modelo é não-confiável e gera retrabalho real.

### Regra 6 — Confirmar estado real do repo antes de codar bloco grande

Aprendido na dor: Fase 3 / B6 ficou não-commitado e o Vercel quebrou no
B6/fix porque eu assumi "commitou ok". Daqui pra frente:

- **Antes de codar bloco com 5+ arquivos:** pedir `git status` ou
  `Get-ChildItem` do diretório relevante.
- **Depois de cada bloco entregue:** pedir `git log --oneline -3` no final
  pra confirmar que o commit existe.
- **Quando o user diz "commitado":** acreditar **MAS** verificar uma vez
  no log antes de seguir pro próximo bloco. Custa 1 mensagem, evita
  retrabalho de 30min.

### Regra 7 — Diagnóstico antes de fix em segunda tentativa

Se o primeiro fix não resolveu: **forçar evidência real** antes de chutar
de novo. Console.log, F12 Network, SQL direto, web_fetch real contra API.

Lição cara: gastei 3 mensagens chutando endpoints OFF (cgi/search.pl → v2 →
search-a-licious) antes de fazer `web_search` + `web_fetch` reais. Quando
finalmente pesquisei, achei o issue oficial do mesmo bug (503 global em
abril/2026). Teria economizado 2 mensagens.

**Regra prática:** se a segunda tentativa não funciona, parar de chutar e
ir pra evidência (search + fetch reais).

### Regra 8 — Listar arquivos como novos vs editados em entregas com 5+ arquivos

Quando entrega tem muitos arquivos, separar visualmente:

> 🆕 **Novos (3):** arq1, arq2, arq3
> 📝 **Editados (4):** arq4, arq5, arq6, arq7

Ajuda Ricardo a entender o que pode sobrescrever localmente sem pensar.

### Regra 9 — Formato dos comandos de commit

Quando bloco passa na validação, oferecer **bloco git pronto pra colar**:

```bash
git add <paths>
git commit -m "<tipo(escopo): mensagem>"
git push
git log --oneline -3
```

Não esquecer o `git log -3` (regra 6).

### Regra 10 — Não presumir capacidades do ambiente

Sempre confirmar antes de incluir num plano:
- "Você tem Docker instalado?" antes de propor Edge Function
- "Tem CLI do Supabase?" antes de propor migrations via CLI
- "Qual é o caminho do arquivo X?" antes de gerar paths chutados

Ricardo prefere "antes de codar, preciso confirmar Y" do que "esse fix
exige Z que você precisa instalar, e mais 3 coisas que você não sabia".

### Regra 11 — Não interpretar excessivamente as mensagens do usuário

Ricardo é direto. Quando ele diz "passou, vamos seguir", significa
"passou + commitei + push feito". Quando ele diz "tudo certo, commitado",
significa o mesmo. **Não pedir validação adicional do óbvio** ("você
realmente testou?"). Aceitar e seguir.

Por outro lado: quando Ricardo descreve um problema específico ("o teste X
deu erro Y"), **focar no problema específico** sem expandir pra outros
cenários que ele não mencionou.

### Regra 12 — Memória persistente (memory_user_edits)

Ricardo tem 2 instruções permanentes salvas:
- Projeto NutriPlan V2 em `C:\projetos\nutriplan-v2` (Windows/PowerShell)
- Anti-mental-arithmetic: sempre via `bash_tool` com Python ou rodando código

Não duplicar essas no STATUS — já estão no contexto via user memories.

---

## 2. ESTADO ATUAL DA PRODUÇÃO

### Banco Supabase

- **Região:** São Paulo
- **Tabelas:** 14 (foods, profiles, daily_logs, log_meals, log_entries,
  meal_plans, plan_meals, plan_slots, slot_options, option_items,
  composite_food_items, user_food_prefs, weight_logs, plan_day_adjustments)
- **RPCs disponíveis (apenas 2):**
  - `search_foods(p_user_id, p_query, p_filter, p_limit)` — busca ranqueada
  - `search_unused_cached_off(p_user_id, p_query, p_limit)` — OFFs cacheados
    não usados pelo user
- **RPCs do blueprint que AINDA NÃO FORAM MIGRADAS** (precisarão ser criadas):
  - `get_or_create_daily_log(p_user_id, p_date)` — Fase 4 do projeto
  - `activate_meal_plan(p_user_id, p_plan_id)` — Fase 5
  - `get_plan_tree(p_plan_id)` — Fase 5
  - Triggers de cleanup pra `plan_day_adjustments` — Fase 5
- **Dados em foods:** 591 TACO + 17 OFF cacheados do V1 (sem dono) + custom
  foods criados em teste pela conta `teste1@nutriplan.dev` (Whey + Pasta).

### Deploy

- **Frontend:** Vercel auto-deploy de `main`
- **Backend:** Supabase prod (mesmo projeto do V1, schema migrado)
- **Sem staging.** Push é prod.

### Contas de teste

- `teste1@nutriplan.dev` — onboarding completo, 1-2 custom foods criados
- `teste2@nutriplan.dev` — onboarding completo

### Bundle atual

700KB minified / 197KB gzip. Warning de chunk size > 500KB acompanhando
desde Fase 2. **Não atacar agora** — code-splitting fica pra Fase 7 (PWA).

---

## 3. CONVENÇÕES DE CÓDIGO DO PROJETO

### Estrutura de pastas

```
src/
├── App.tsx                      # Routes + AuthGuard
├── main.tsx                     # QueryClient instantiated INLINE aqui
├── lib/
│   ├── supabase.ts              # cliente
│   ├── macros.ts                # BMR/TDEE/cálculos
│   ├── utils.ts                 # cn() do shadcn
│   └── utils-format.ts          # formatadores pt-BR
├── types/
│   └── database.ts              # Supabase generated types (manter sincronizado!)
├── components/ui/               # shadcn primitivos
└── features/
    ├── auth/
    │   ├── context/auth-context.ts
    │   ├── components/auth-guard.tsx
    │   ├── hooks/useAuth.ts     # ⚠️ camelCase (legado!)
    │   └── routes/{login,signup}.tsx
    ├── home/routes/index.tsx
    ├── dashboard/routes/dashboard.tsx
    ├── onboarding/...           # Fase 2
    ├── profile/...              # Fase 2
    └── foods/                   # Fase 3
        ├── lib/{types,schemas,query-keys}.ts
        ├── hooks/use-*.ts       # kebab-case
        ├── components/*.tsx
        └── routes/*.tsx
```

### Padrões obrigatórios

**1. `useAuth` em camelCase, todos os outros hooks em kebab-case.**

`useAuth` é feature mais antiga (Fase 1) e ficou assim. Features novas usam
`use-profile`, `use-food-search`, `use-toggle-hide` etc.

**2. Tipos do Supabase em `@/types/database`.**

NÃO `@/lib/database.types` (era o que eu chutei errado na primeira tentativa).

**3. `QueryClient` instanciado INLINE em `main.tsx`.**

Não tem arquivo `query-client.ts` separado. Não criar — segue o padrão atual.

**4. Hooks de query retornam objeto amigável, NÃO o cru do TanStack.**

```ts
// ✅ CORRETO — padrão do projeto
return {
  profile: result.data,
  loading: result.isLoading,
  error: result.error,
  refetch: result.refetch,
}

// ❌ ERRADO — não fazer
return useQuery({ ... })  // expõe demais
```

**5. Tipos gerados pelo Supabase tipam campos sem nullability honesta.**

A RPC `search_foods` retorna `brand: string` no tipo gerado, mas o banco
manda `null`. **Sempre criar tipos manuais** em `lib/types.ts` da feature
quando o resultado tem optional fields, e fazer `as unknown as MyType`
no boundary.

**6. RLS está ativa em tudo. Não tentar contornar.**

Cada user só vê seus próprios `profiles`, `user_food_prefs`, `daily_logs`,
etc. Foods globais (TACO/OFF com `user_id IS NULL`) são SELECT-only pra
todos os users. Schema das tabelas está em §4.

**7. Forms: pattern fixo com RHF + zod + shadcn `<Form>` + Sonner**

Padrão estabelecido em Fase 2 (`profile-edit.tsx`) e Fase 3 (`food-new.tsx`):

```ts
const form = useForm<InputType, unknown, OutputType>({
  resolver: zodResolver(schema),
  mode: 'onSubmit',
  defaultValues: DEFAULTS,
})

const handleSave = async () => {
  const ok = await form.trigger()
  if (!ok) {
    toast.error('Há campos com erro. Revise e tente de novo.')
    return
  }
  const values = form.getValues() as unknown as OutputType
  mutation.mutate(values, { onSuccess: ..., onError: ... })
}

// JSX:
<form onSubmit={(e) => e.preventDefault()}>
  ...
  <Button type="button" onClick={handleSave}>Salvar</Button>
</form>
```

Notas críticas:
- **Botão `type="button"` + `onClick`**, NÃO submit via Enter.
- **Form não submete sozinho** (`onSubmit={preventDefault}`).
- **`useForm` com 3 generics**: `<Input, unknown, Output>` pra discriminated
  unions ou schemas com `.optional()` funcionarem com RHF v8.
- **NÃO usar `.transform()` no zod** — RHF v8 + discriminated union quebra.
  Normalização ('' → null, trim, etc) acontece no `mutationFn` do hook.

**8. Mutations com optimistic update e shapes diferentes coexistindo**

Quando `queryKey: foodKeys.all` cobre múltiplos shapes (search retorna array,
detail retorna objeto), **NÃO usar `setQueriesData` genérico**. Filtrar por
predicate na queryKey:

```ts
queryClient.setQueriesData<FoodSearchResult[]>(
  {
    queryKey: foodKeys.all,
    predicate: (query) => query.queryKey[1] === 'search',
  },
  (old) => { ... }
)
```

Bug do B6 (fix do toggleFavorite): violar isso quebra com `old.map is not a
function` quando o detail entra no cache.

**9. Query keys centralizadas em `lib/query-keys.ts` por feature**

```ts
export const foodKeys = {
  all: ['foods'] as const,
  search: (params) => ['foods', 'search', params] as const,
  detail: (id) => ['foods', 'detail', id] as const,
  hidden: () => ['foods', 'hidden'] as const,
}
```

Convenção: `feature.all` é o prefix maior pra invalidação ampla. Subseções
sempre como `['feature', 'subname', ...]` pra filter por predicate funcionar.

**10. Componentes shadcn que NÃO temos**

Ricardo NÃO tem `<Switch>`, `<Checkbox>`, `<Select>`, `<Dialog>`, `<Sheet>`,
`<DropdownMenu>`. Pra essas:
- Checkbox → `<input type="checkbox">` cru (vide profile-edit, food-form-fields)
- Select → `<RadioGroup>` (vide food-form-mode-select)
- Dropdown/Sheet → implementação manual `div absolute` (vide food-row-menu)

Não sugerir instalar sem perguntar.

### Estilo de comentário

Código tem comentários PORTUGUESES, explicativos, sobre **decisões** (não
sobre "o que o código faz"). Padrão de docs internas: bloco no topo do
arquivo explicando *por quê*, comentário inline quando tem decisão sutil.

Exemplos válidos:
- "RHF v8 + zod v4 + discriminated union interage mal com transforms"
- "Cast intencional: tipo gerado não preserva nullability"
- "Default 100g quando OFF não declara serving — fallback canônico de
  rótulos brasileiros"

---

## 4. SCHEMA DO BANCO (CHEAT SHEET)

### Tabelas relevantes pra Fase 4

```
daily_logs (user_id, logged_on, calorie_target_snapshot,
            protein_target_snapshot, carb_target_snapshot,
            fat_target_snapshot, plan_id NULL, ...)
   UNIQUE (user_id, logged_on)
   default logged_on = (now() AT TIME ZONE 'America/Sao_Paulo')::date
   ↓ FK 1:N
log_meals (id, daily_log_id, name, sort_order, plan_meal_id NULL)
   ↓ FK 1:N
log_entries (id, log_meal_id, food_id, grams, kcal, protein, carbs, fat,
             is_off_plan boolean)
```

**Campos desnormalizados em `log_entries`** (kcal, protein, carbs, fat):
calculados no momento do log a partir do food + grams. Editar food depois
**não** muda logs antigos. Decisão deliberada.

### Tabelas de plan (Fase 5+)

```
meal_plans (id, user_id, name, is_active, ...)
   UNIQUE partial (user_id) WHERE is_active = true  ← 1 ativo por user
   ↓ FK 1:N
plan_meals (id, plan_id, name, sort_order)
   ↓ FK 1:N
plan_slots (id, plan_meal_id, type 'OR'|'ITEMS', sort_order)
   ↓ FK 1:N (quando type='OR')      |  ↓ FK 1:N (quando type='ITEMS')
slot_options (id, plan_slot_id)     |  option_items (id, plan_slot_id, food_id, grams)
   ↓ FK 1:N
option_items (id, slot_option_id, food_id, grams)
```

E `plan_day_adjustments` (user_id, daily_log_id, plan_meal_id,
plan_slot_id, picked_option_id, ...): registra escolhas pontuais que
divergem do plano sem alterá-lo.

### Tabelas de food

```
foods (id, user_id NULL, source 'taco'|'open_food_facts'|'custom'|'composite',
       external_id NULL, name, brand, kcal_per_100g, protein_per_100g,
       carb_per_100g, fat_per_100g, fiber_per_100g, sugar_per_100g,
       saturated_fat_per_100g, sodium_mg_per_100g, default_serving_g,
       serving_label, recalc_whole_units_only, is_archived,
       macros_manually_overridden, category, created_at)
   user_id IS NULL → global (TACO, OFF cacheado)
   user_id IS NOT NULL → custom/composite do user

user_food_prefs (id, user_id, food_id, is_favorite, is_hidden,
                 use_count, last_used)
   UNIQUE (user_id, food_id)  ← upsert com onConflict='user_id,food_id'

composite_food_items (id, composite_food_id, ingredient_food_id, grams,
                      sort_order)
   pra Fase 4.5/5 — receitas compostas (NÃO implementadas na Fase 3,
   adiadas)
```

### Tabelas de profile / weight

```
profiles (id, display_name, sex, birth_date, height_cm, weight_kg,
          activity_level, goal, calorie_target, protein_target,
          carb_target, fat_target, onboarding_completed, ...)

weight_logs (id, user_id, weight_kg, logged_on)
   UNIQUE (user_id, logged_on)
```

### RPC `search_foods` (CRÍTICA pra Fase 4 também)

```sql
search_foods(p_user_id uuid, p_query text, p_filter text DEFAULT 'all',
             p_limit integer DEFAULT 30)
```

**Filtros aceitos** (literais exatos):
- `'all'` — TACO + custom + composite + OFFs JÁ USADOS pelo user
- `'taco'` — só TACO
- `'off'` — só OFFs (incluindo não-usados — mostra cacheados antigos)
- `'mine'` — só foods criadas pelo user
- `'favorites'` — só com `is_favorite=true`
- `'recent'` — só com `last_used IS NOT NULL`
- `'frequent'` — só com `use_count > 0`

**Ranking** (server-side, no `rank_score`):
- Similaridade trigram com `unaccent` (peso 10)
- Bonus +2 pra cozidos/grelhados/assados; penalidade -2 pra crus
- Bonus por uso (`LEAST(use_count, 20) * 0.5`)
- Bonus +5 se usado nos últimos 7 dias
- Bonus +3 se favoritado
- Bonus +1 se TACO

Filtro `'all'` exclui OFF se `use_count = 0` — OFFs cacheados não-usados
não poluem a busca padrão; user precisa abrir filtro `'off'` pra ver.

`search_foods` JÁ FILTRA `is_hidden=true` automaticamente — feature de
hide pega de graça.

---

## 5. FASE 0 — FECHADA ✅ (recap mínimo)

End-to-end vivo: GitHub → Vercel → Vite bundle → React → Supabase
client tipado → query real → 591 alimentos renderizados.

Stack: Vite 8 + React 19 + TS 6 + Tailwind v3 + shadcn classic.
Backend Supabase próprio (SP). Detalhes no histórico.

---

## 6. FASE 1 — FECHADA ✅ (recap mínimo)

Auth foundation: TanStack Query + react-router + RHF + zod + sonner.
Rotas: `/`, `/login`, `/signup`, `/dashboard` (com AuthGuard).
Trigger `handle_new_user` validado: signup cria row em `auth.users` E
em `public.profiles`.

Provider tree: `StrictMode → QueryClient → AuthProvider → App`.

---

## 7. FASE 2 — FECHADA ✅ (recap mínimo)

Onboarding multi-step + BMR/TDEE/macros + persistência + `/profile`
readonly + `/profile/edit` com MacroEditor dual-mode (g/%) + AuthGuard
v2 (sem user → /login; sem onboarding → /onboarding; pronto → children).
2 contas validadas em prod.

**Padrões críticos estabelecidos aqui** (usados na Fase 3 também):
- `useForm` com generic Output explícito pra zod com optional/transform
- `MacroEditor` source-of-truth em gramas, modo controla display
- `UnitInput` com string em edição local (evita pulo de casa decimal)
- Migration 8.5 hardcoda timezone BR no default de `daily_logs.logged_on`

---

## 8. FASE 3 — FECHADA ✅ (DETALHADA — fase recém-fechada)

### Entrega final

Rota `/foods` com:
- **Busca ranqueada** TACO + custom + composite (com 7 filtros pills)
- **Estrela** pra favoritar com optimistic update
- **Menu •••** com "Ocultar" + toast undo de 5s
- **FAB** `+` no canto inferior pra criar custom food
- **Rota `/foods/new`** com form dual-mode (Por 100g / Por porção)
- **Rota `/foods/:id`** detail readonly (mostra macros por porção E por 100g)
- **Rota `/foods/:id/edit`** edit (só per-100g, só pro dono)
- **Seção "Alimentos ocultos"** colapsável no `/profile`

### Blocos executados

| Bloco | Conteúdo | Commit |
|---|---|---|
| B1 | useFoodSearch hook + /foods skeleton | b3c4480 |
| B2 | Search bar com debounce + skeleton | 2561088 |
| B3 | Filter pills (7 filtros) | 0f31e59 |
| B4 | Toggle favorite com optimistic | f8a5d8e |
| B5 | Create custom food (form dual-mode) | 7e99243 |
| B6 | Detail readonly + Edit | 8c29318 |
| B6-fix | Toggle favorite quebrava com detail cache | 89111e8 |
| B7+B8 | OFF API integration (REVERTED — ver §10) | — |
| B9 | Hide foods + undo + profile section | 874b1be |

### Decisões importantes

**1. Tipos do Supabase para `search_foods` retornam SEM nullability.**

Workaround: criamos `FoodSearchResult` em `lib/types.ts` com nullability
honesta. Cast `as unknown as FoodSearchResult[]` no hook.

**2. Filtro `'all'` da `search_foods` exclui OFFs não-usados.**

Comportamento intencional do SQL. Não é bug. Pra ver OFFs cacheados,
filtro `'off'`. Pra OFFs aparecerem em `'all'`, precisa de `use_count > 0`
(que vem da Fase 4 quando user loga).

**3. RHF v8 + zod v4 + discriminated union NÃO funciona com `.transform()`.**

Erro de tipo cascateava em todos os sub-componentes do form. Solução:
remover `.transform()` do schema, normalizar no `mutationFn` do hook,
e tipar `useForm<Input, unknown, Output>` com 3 generics.

**4. Cache híbrido (search array + detail object) sob mesmo prefix.**

`foodKeys.all = ['foods']` cobre `['foods','search',...]` (array) e
`['foods','detail',id]` (objeto). `setQueriesData` ingênuo quebra com
`.map is not a function`. Solução: predicate por `queryKey[1]`.

**5. FAB (Floating Action Button) é padrão mobile-first do app.**

`fixed bottom-6 right-6 z-10` com ícone `Plus` da lucide. App é PWA
mobile-first, FAB é mais ergonômico que header com link.

**6. Edit usa SEMPRE per-100g (não dual-mode).**

Banco guarda canônico per-100g. Reverter pra "Por porção" tem ambiguidade
(30g→100g e 33g→100g podem dar mesmo per-100g). Edit parte do canônico.

**7. Menu ••• implementado MANUAL (não shadcn DropdownMenu).**

Evitou instalar `@radix-ui/react-dropdown-menu`. `div absolute` com
fechamento por click-outside + Esc. Reusável e simples.

**8. Toast com undo de 5s usando `action` do Sonner.**

Padrão moderno (Gmail / Material Design). 5s é window confortável.
Pra desfazer, dispara mutation oposta com `currentIsHidden` invertido.

### Estrutura final da feature foods

```
src/features/foods/
├── lib/
│   ├── types.ts             # FoodSource, FoodSearchFilter, FoodSearchResult
│   ├── schemas.ts           # customFoodSchema (discriminated) + editFoodSchema
│   └── query-keys.ts        # foodKeys.{all,search,detail,hidden}
├── hooks/
│   ├── use-debounced-value.ts
│   ├── use-food-search.ts   # RPC search_foods
│   ├── use-food.ts          # detail + isFavorite + isHidden + isOwn
│   ├── use-toggle-favorite.ts   # optimistic + rollback
│   ├── use-toggle-hide.ts       # optimistic com filter (não map)
│   ├── use-hidden-foods.ts      # lista pro profile section
│   ├── use-create-food.ts       # INSERT
│   └── use-update-food.ts       # UPDATE com WHERE user_id (defesa)
├── components/
│   ├── food-search-bar.tsx
│   ├── food-filter-pills.tsx    # 7 pills com scroll horizontal
│   ├── food-row.tsx             # estrela + ••• + Link wrap
│   ├── food-row-menu.tsx        # ••• pop-out manual
│   ├── food-results-list.tsx
│   ├── food-form-mode-select.tsx     # radio Por 100g / Por porção
│   ├── food-form-fields.tsx          # campos comuns
│   ├── food-form-macros-100g.tsx
│   ├── food-form-macros-serving.tsx  # com preview ao vivo
│   └── hidden-foods-section.tsx      # collapsible no profile
└── routes/
    ├── foods.tsx
    ├── food-new.tsx
    ├── food-detail.tsx
    └── food-edit.tsx
```

### Lições especificas da Fase 3 (NÃO REPETIR esses erros)

**Erro 1 — Eu chutei endpoint da Open Food Facts em vez de pesquisar.**

Tentei `cgi/search.pl` (CORS bloqueado + 503 global desde abr/2026) e
`api/v2/search` (não faz full-text). Só depois fiz `web_search` e achei
que **a solução real é Search-a-licious** via Edge Function. Custou
~5 mensagens de retrabalho. Próxima vez: web_search desde a primeira
tentativa pra APIs externas.

**Erro 2 — Eu assumi "commitou" sem verificar.**

B6 ficou não-commitado, mas o fix do B6 sim. Vercel quebrou no fix.
Daqui pra frente: regra 6 (`git log -3` no fim de cada bloco).

**Erro 3 — Tipo gerado do Supabase não tem nullability honesta.**

Não vi isso até gerar `useFoodSearch`. Demorei pra entender que era um
problema sistêmico, não só de `search_foods`. Sempre tipar manual no
boundary de feature pra resultados com optional fields.

**Erro 4 — `setQueriesData` com prefix amplo quebrando shapes diferentes.**

Bug do B4 que só apareceu no B6 (quando detail entrou no cache). Corrigido
no B6-fix. Lição: `predicate` filtrando `queryKey[1]` é o caminho seguro.

---

## 9. ANTI-PADRÕES OBSERVADOS (PRA NÃO REPETIR)

Anti-padrões que aconteceram em algum momento durante a Fase 3, registrados
pra próximo Claude evitar:

### A1. Chutar antes de pesquisar

Quando enfrentar problema de API externa, biblioteca, comportamento
inesperado de framework: **`web_search` primeiro, código depois**. Custa
1 tool call e pode salvar várias mensagens.

### A2. Entregar 8 arquivos sem distinção visual de novos vs editados

Ricardo perdeu tempo lendo no B6 sem saber quais 4 dos 8 arquivos
sobrescreveriam código existente. Solução: regra 8.

### A3. Assumir caminhos de arquivo sem confirmar

No início da Fase 3 chutei `src/lib/database.types.ts` quando o real era
`src/types/database.ts`. Solução: pedir mapa antes de codar bloco grande.

### A4. Otimismo sobre encoding silencioso

Quando Ricardo mostra arquivo com mojibake no `Get-Content`, **isso é
visual, não bug**. Pra confirmar: `Get-Content X -Encoding UTF8`. Não
gastar 2 mensagens debatendo encoding sem evidência.

### A5. Pular validação manual e tentar pular pra próximo bloco

Tentei isso na primeira interação do B6. Ricardo cortou: "vou pular pro
commit pra não gastar crédito a toa". OK, mas a regra é: **validação
manual é por bloco, não opcional**. Quando Ricardo dá OK, segue.

### A6. Sugerir Edge Function / Docker / Supabase CLI sem confirmar setup

Tentei isso no B7. Ricardo não tinha CLI. Resultado: pivot pra "Caminho B"
que também não funcionou. Confirmar setup antes de propor solução que
exige infra nova. Regra 10.

---

## 10. PENDÊNCIAS ABERTAS (prioridade alta primeiro)

### P1 — Open Food Facts: integração via Edge Function (alta)

**Contexto:** B7+B8 foi revertido. O cgi/search.pl da OFF está retornando
503 globalmente desde abr/2026 (issue documentado: github.com/CodeWithCJ/SparkyFitness/issues/1079).
A v2 search não faz full-text. A solução real é Search-a-licious via
proxy server-side.

**Quando atacar:** depois da Fase 4 (que destrava o flow de logar). Não
adianta cachear OFFs se não dá pra logar eles ainda.

**Como atacar:**
1. Instalar Supabase CLI + Docker (precisa confirmar com Ricardo)
2. Criar Edge Function `off-search` em `supabase/functions/off-search/index.ts`
3. Proxy pra `search.openfoodfacts.org` (Search-a-licious) com User-Agent
   customizado e filter de `countries_tags=en:brazil`
4. Cliente JS chama Edge Function (CORS resolvido pelo Supabase)
5. Reintroduzir os 5 arquivos que apaguei (estavam no /home/claude no
   commit anterior, mas se precisar consigo refazer com o blueprint
   como referência)

**Estimativa:** 1-2 dias dependendo do Docker setup.

### P2 — Bundle size warning (média)

700KB / 197KB gzip. Foge do limite recomendado de 500KB. Code-splitting
via `React.lazy` por rota resolve. Atacar na Fase 7 (PWA), junto com
service worker.

### P3 — React Router v6 warnings de v7 (baixa)

Console mostra:
- `v7_startTransition`
- `v7_relativeSplatPath`

Silenciáveis com flags de opt-in no `<BrowserRouter>`. Inofensivos.
Atacar quando migrar pra v7 ou no próximo refactor maior.

### P4 — Reset de senha (baixa, mas vira urgente quando alguém esquecer)

Sub-fase 1.1 do blueprint nunca foi feita. Primeira pessoa que esquecer
a senha vai precisar.

### P5 — `forwardRef` deprecation em React 19 (baixa)

`radio-group.tsx` e `progress.tsx` usam padrão antigo. Quando bater
warning real ou refactor maior, migrar.

### P6 — Receita composta (média, fase própria)

Fase 2.3 do blueprint (NÃO 2.3 do projeto). Foi adiada pra fase própria
depois da Fase 3. Composite foods já existem no banco mas UI pra criar
não. Atacar depois da Fase 4 (precisa AddFoodFlow funcionando).

### P7 — Service workers / PWA install (baixa, fase própria)

Fase 7 do projeto.

### P8 — Migrar `forwardRef` Item F do STATUS antigo (baixa)

Já listado em P5.

### P9 — Transação real no submit do onboarding (baixa)

Item K do STATUS antigo. `use-complete-onboarding` faz 2 chamadas
separadas. Risco baixo (raramente falha).

### P10 — MacroEditor mora em `onboarding/components/` mas é usado em profile

Item L do STATUS antigo. Refactor quando virar caso maior.

---

## 11. PRÓXIMA FASE — FASE 4 DO PROJETO (= "Fase 3" do blueprint)

⚠️ **Atenção à renumeração:** o blueprint começa em "Fase 0" e tem "Fase 1,
Fase 2, Fase 3 — Diário Diário, Fase 4 — Planos...". A gente está chamando
no STATUS de "Fase 0, 1, 2, 3 (= banco de alimentos), 4 (= diário diário)".
Próximo chat: **Fase 4 = Diário Diário** = "Fase 3" do blueprint, parte 7.

### Entrega da Fase 4

Tela Home (`/dashboard` ou novo `/`) com:
- DateNavigator (setas pra mudar dia, mostra DD/MM)
- Daily progress card (ring de calorias central + 3 barrinhas P/C/F)
- Cards de refeições (log_meals) com seus entries
- Add entry / delete entry / delete meal
- Dialog pra criar log_meal manual

### Sub-fases do blueprint

**4.1 — Infraestrutura do daily log**
- RPC `get_or_create_daily_log(p_user_id, p_date)` — **PRECISA SER CRIADA**
- `useDailyLog(date)` hook
- `DateNavigator` component

**4.2 — Daily progress card**
- Ring + 3 barras com cores conforme convenção
- Soma todos entries do dia

**4.3 — Meal cards**
- Lista log_meals com entries
- "Esperado vs Comido" quando há plano ativo
- Ações: add/delete entry, delete meal

**4.4 — New meal dialog**
- Botão "Adicionar refeição" → dialog cria log_meal manual

**Bonus possível (2.6 do blueprint adiado):**
- `AddFoodFlow` — sheet 2-step (pick meal + quantity)
- Botão pra logar food a partir de `/foods` (que hoje é só busca)

### Coisas necessárias antes de começar

1. **Criar RPC `get_or_create_daily_log`.** Precisa de SQL. Discutir
   com Ricardo: criar via dashboard SQL editor ou via migration file.
   Lógica: SELECT por (user_id, logged_on); se não existe, INSERT com
   snapshots de targets vindos do profile.

2. **Decidir sobre cleanup-and-seed pra plano ativo.** Se user tem plano
   ativo, o INSERT do daily_log deve popular log_meals/log_entries baseado
   no plano. Mas planos só são Fase 5! Pra Fase 4: ignorar plano,
   `daily_log` começa vazio, user adiciona manualmente.

3. **Decidir UI de quantity input.** Reusar `UnitInput` da Fase 2 ou criar
   componente novo? `UnitInput` tem dependência do MacroEditor — extrair
   pra `src/components/unit-input.tsx` faz sentido.

4. **AddFoodFlow é parte da Fase 4 ou fase própria?** Blueprint sugere
   integrar em `/foods` E em `/log/add`. Recomendo: parte da Fase 4 porque
   sem ela o flow de logar não fecha.

### Decisões pendentes pra Ricardo na Fase 4

- Onde mora `/` do app autenticado? Hoje é `/dashboard` (placeholder).
  Trocar pra Home? Manter `/dashboard` como Home?
- Cor/estilo do ring de calorias (chart.js? SVG manual? recharts?)
- Botão "logar food" mora em `/foods` (FAB? Header? Na row?) ou só na home?

### Estimativa

4-6 turns (blueprint) — em prática mais, dado padrão de bloqueio detalhado
do Ricardo. Provavelmente 8-12 blocos pequenos.

---

## 12. FORMATO DE INÍCIO DO PRÓXIMO CHAT

Ricardo vai abrir chat novo com algo tipo:

> "Lê STATUS.md inteiro, especialmente as regras. Vamos começar a Fase 4."

**Resposta esperada:**

1. Ler STATUS inteiro de fato (não pular pras regras)
2. Confirmar contexto: "Fase 4 = Diário Diário. Estado atual: commit
   `874b1be`. Banco tem `get_or_create_daily_log` por criar."
3. **Propor escopo da Fase 4** — quais sub-fases entram, na ordem,
   estimando blocos
4. **Listar decisões pendentes** (§11 pontos 1-4 acima) e perguntar
5. Não codar até ter respostas

**Não fazer:**
- Pular pra "vou criar a RPC" sem confirmar formato (dashboard vs migration)
- Assumir que ring de calorias é chart.js
- Codar componentes antes de Ricardo aprovar escopo

---

## 13. APÊNDICE A — Comandos PowerShell úteis pra inspeção

```powershell
# Estrutura do projeto
Get-ChildItem -Recurse -Path src -Force |
  Where-Object { $_.FullName -notmatch '\\node_modules\\' } |
  Select-Object -ExpandProperty FullName

# Ler arquivo TS com UTF-8 (sem mojibake)
Get-Content C:\projetos\nutriplan-v2\<caminho> -Encoding UTF8

# Verificar estado git
git status
git log --oneline -5
git diff --stat <paths>

# Build e dev
bun run build
bun run dev

# SQL no Supabase (no dashboard, SQL Editor)
-- Listar RPCs
SELECT routine_name FROM information_schema.routines
WHERE routine_schema='public' AND routine_type='FUNCTION';

-- Definição de RPC
SELECT pg_get_functiondef('public.<nome>'::regproc);

-- Schema de tabela
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='<tabela>'
ORDER BY ordinal_position;
```

---

## 14. APÊNDICE B — Padrão de entrega de bloco (template)

Estrutura ideal de mensagem ao final de um bloco de trabalho:

````
## B<N> — <título curto>

🆕 **Novos (X):** lista
📝 **Editados (Y):** lista

[comandos PowerShell pra mover arquivos]

```powershell
bun run build
bun run dev
```

## Validação manual (Z min)

[cenários numerados, com expectativa específica em cada um]

## Se passar:

```bash
git add <paths>
git commit -m "<tipo(escopo): mensagem>"
git push
git log --oneline -3
```

⚠️ Cola o `git log -3` depois do push.

## Possíveis ruídos antecipados (opcional)

[problemas que podem aparecer, com diagnóstico antecipado]
````

---

**FIM.** Boa sorte ao próximo Claude. Ricardo é direto, valoriza honestidade
sobre o que você não sabe, e não tolera retrabalho por chute. Pesquisa
quando não sabe. Confirma quando não tem certeza. Entrega blocos pequenos.
