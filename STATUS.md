# NutriPlan V2 — STATUS

**Última atualização:** 2026-05-13 (fim da Fase 4 do projeto)
**Commit em prod:** `9bf5779` — `feat(foods): logar via /foods + preservar busca na back nav + FAB acima do BottomNav`
**Repo:** github.com/ricardoeid/nutriplan-v2 — Vercel deploy autom em `main`

Este arquivo é o ponto de retomada do projeto. Próximo chat lê isso, fecha
o arquivo, e começa a Fase 5 com contexto suficiente pra trabalhar sem
reler o histórico todo. **É a fonte canônica de verdade** — quando houver
conflito entre este documento e qualquer outro (blueprint, memórias), o
STATUS vence pra o estado atual; o blueprint vale como roadmap.

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
- **Não programa.** Lê código quando indicado mas depende do modelo explicar
  o que está em jogo nas decisões (ver Regra 1B).

### Sobre o projeto

NutriPlan é um app de planejamento e tracking alimentar. Distribuição
**100% nativa** (iOS + Android via Capacitor) — sem PWA. Mercado BR. Foco em:

- Banco TACO (591 alimentos brasileiros) + custom foods + composite recipes
- Open Food Facts integrado (adiado — ver §11)
- Planos alimentares estruturados (Fase 5 do projeto = atual)
- Motor de substituição protein-aware (Fase 6 do projeto)

V1 foi escrito no Lovable Cloud + TanStack Start. V2 é rewrite from scratch
no stack abaixo, com o mesmo banco Supabase migrado.

### Decisão estratégica nova (2026-05-13)

**App vai ser distribuído como nativo iOS + Android via Capacitor, sem PWA.**
Isso reformula a antiga "Fase 6 — PWA" do blueprint, que vira "preparar pra
Capacitor" mais pra frente. **Não gastar esforço em service worker, manifest
PWA completo, ícones maskable, install prompt no browser.** Pendência P9
("service workers / PWA") do STATUS antigo fica obsoleta na forma original.

### Stack atual (NÃO MUDAR sem motivo forte)

```
Vite 8 + React 19 + TypeScript 6
Tailwind v3 + shadcn/ui classic
TanStack Query 5 (estado server)
react-router-dom v6
react-hook-form 7 + zod 4 + @hookform/resolvers 5
sonner 2 (toasts)
Supabase JS 2 (auth + DB + futuramente Edge Functions)
Bun (package manager + script runner)
supabase CLI 2.98 (devDep — `bunx supabase ...`)
```

**Como confirmar versões reais (Regra 13):**

```powershell
Get-Content C:\projetos\nutriplan-v2\package.json -Encoding UTF8
```

shadcn primitivos instalados:
**button, card, form, input, label, progress, radio-group, sonner.**

**Nada de @radix-ui/react-dropdown-menu, @radix-ui/react-dialog,
@radix-ui/react-sheet, @radix-ui/react-checkbox, @radix-ui/react-select,
@radix-ui/react-switch, @radix-ui/react-popover** — quando precisarmos de
dropdown/dialog/sheet, primeiro discutir custo-benefício de instalar vs
implementar manual. Na Fase 3 (B9 hide foods) e Fase 4 (B5 LogRowMenu,
B6 NewMealDialog, B7 AddFoodSheet) fizemos tudo manual com sucesso —
divs com click-outside, focus management, body scroll-lock. Padrão
estabelecido. Veja §3 padrão 10.

### lucide-react versão estranha

`package.json` declara `lucide-react: ^1.14.0`. A versão real instalada
pela registry mirror é alta (>= 0.4xx). Funciona normal — não mexer.

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

### Regra 1B — Sempre explicar o que está em jogo nas decisões

Quando apresentar opções (técnicas, de produto, de arquitetura, escolha
de lib, formato de entrega), descrever:
- **O que cada opção é** em linguagem clara
- **Custo concreto** (KB no bundle, linhas de código, refactor exigido,
  nova dependência)
- **Ganho concreto**
- **Implicação futura**
- **Recomendação explícita com o porquê**

Ricardo é leigo em zod/RHF/TanStack/infra Supabase/chart libs e depende
de contexto pra decidir. Opções secas com 1 linha cada **não bastam** —
ele explicitou isso na transição B3→B3.5 da Fase 4. Vale tanto pra
decisões grandes (stack) quanto pequenas (qual ícone).

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
- `bun run dev` faz Ctrl+C no terminal — Ricardo mata depois. O exit code
  58 que aparece é só "process killed by signal", não erro real.

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
> 🗑️ **Deletados (X):** arqA

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
- "Tem CLI do Supabase?" → **sim, já está em devDep como `supabase: ^2.98.0`.
  Roda via `bunx supabase ...`. Sem precisar de Docker** pra trabalhar
  contra cloud (Docker só é necessário pra `supabase start` local).
- "Tem Docker?" antes de propor `supabase start` local.
- "Qual é o caminho do arquivo X?" antes de gerar paths chutados.

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

### Regra 13 — Confirmar versões reais e schema antes de propor blocos

`package.json` é a **fonte canônica** de versões. STATUS pode ficar
desatualizado entre fases. No início de qualquer bloco que envolva
APIs específicas de versão (RHF, zod, TanStack Query, React Router,
Tailwind, lucide), pedir:

```powershell
Get-Content C:\projetos\nutriplan-v2\package.json -Encoding UTF8
```

E usar isso como verdade, não suposição. **Instância concreta da Regra 10**
— versão de lib é capacidade do ambiente.

**Vale também pra schema do banco:** antes de propor `CREATE FUNCTION`
ou nova migration, conferir `src/types/database.ts` (gerado do schema
real). RPCs marcadas como "por criar" em fases antigas frequentemente
já existem — ver §2. Pra inspecionar body de função existente:

```sql
SELECT pg_get_functiondef('public.<nome>(<argtypes>)'::regprocedure);
```

### Regra 14 — Mutations com optimistic em componente que vai desmontar

**Padrão crítico aprendido na Fase 4 (B5):** se uma mutation faz optimistic
update que REMOVE o próprio componente que disparou da lista (ex: deletar
uma meal card a partir do menu •••), o componente desmonta antes do
servidor responder. **TanStack Query v5 remove o observer no unmount**,
e todos os callbacks (`onSuccess`/`onError` tanto da hook quanto do `mutate`)
são droppados. Toast não aparece, rollback de erro não acontece, cache
fica inconsistente em caso de falha.

**Solução:** mover a `useMutation` pro componente **pai** que sobrevive ao
unmount do filho. Filho recebe `onAction(...)` como prop. Mutation observer
fica no pai → callbacks executam normalmente.

Implementado em `src/features/log/routes/home.tsx`: `useDeleteEntry`,
`useDeleteMeal`, `useCreateMeal`, `useAddEntry` todas vivem no `HomePage`,
passadas como handlers pro `MealCard`. Em `src/features/foods/routes/foods.tsx`:
`useAddEntry` mora no `FoodsPage`, passado como `onAdd` pro `FoodRow`.

**Quando aplicar:** sempre que uma mutation pode resultar no unmount do
caller (delete em lista renderizada, add que muda navegação, etc).
Mutations que apenas mudam estado dentro do mesmo componente (toggle,
update) podem viver no filho.

---

## 2. ESTADO ATUAL DA PRODUÇÃO

### Banco Supabase

- **Região:** São Paulo
- **Tabelas (14):** foods, profiles, daily_logs, log_meals, log_entries,
  meal_plans, plan_meals, plan_slots, slot_options, option_items,
  composite_food_items, user_food_prefs, weight_logs, plan_day_adjustments

#### RPCs disponíveis (do schema real, `src/types/database.ts`)

**A lista abaixo veio de inspeção direta do schema. STATUS antigos
listavam apenas 2 RPCs como existentes, mas a verdade é que o V1 deixou
várias migradas. Sempre confirmar `src/types/database.ts` antes de propor
`CREATE FUNCTION`.**

| RPC | Args | Returns | Uso |
|---|---|---|---|
| `search_foods` | p_user_id, p_query, p_filter, p_limit | row[] | Busca ranqueada (Fase 3) |
| `search_unused_cached_off` | p_user_id, p_query, p_limit | row[] | OFFs cacheados não usados |
| `get_or_create_daily_log` | p_date date | uuid | Cria/retorna daily_log + seeda log_meals (Fase 4) |
| `activate_meal_plan` | p_plan_id | (void) | Ativa plano + cleanup-and-seed (Fase 5) |
| `get_plan_tree` | p_plan_id | jsonb | Tree completo do plano (Fase 5) |
| `get_daily_log_owner` | dl_id | uuid | Ownership walker pra RLS |
| `get_food_owner` | food_id | uuid | Ownership walker |
| `get_log_meal_owner` | lm_id | uuid | Ownership walker |
| `get_meal_plan_owner` | mp_id | uuid | Ownership walker |
| `get_plan_meal_owner` | pm_id | uuid | Ownership walker |
| `get_plan_slot_owner` | ps_id | uuid | Ownership walker |
| `get_slot_option_owner` | so_id | uuid | Ownership walker |

**Definição completa de `get_or_create_daily_log`** (descoberto no início
da Fase 4 via `pg_get_functiondef`):

```sql
CREATE OR REPLACE FUNCTION public.get_or_create_daily_log(p_date date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_log_id uuid;
  v_user_id uuid := auth.uid();
  v_active_plan_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_log_id FROM public.daily_logs
  WHERE user_id = v_user_id AND log_date = p_date;

  IF v_log_id IS NULL THEN
    SELECT id INTO v_active_plan_id FROM public.meal_plans
    WHERE user_id = v_user_id AND is_active = true LIMIT 1;

    INSERT INTO public.daily_logs (
      user_id, log_date, plan_id,
      calorie_target_snapshot, protein_target_snapshot,
      carb_target_snapshot, fat_target_snapshot
    )
    SELECT v_user_id, p_date, v_active_plan_id,
      calorie_target::int, protein_target::int,
      carb_target::int, fat_target::int
    FROM public.profiles WHERE id = v_user_id
    RETURNING id INTO v_log_id;

    IF v_active_plan_id IS NOT NULL THEN
      INSERT INTO public.log_meals (daily_log_id, name, sort_order, plan_meal_id, target_time)
      SELECT v_log_id, pm.name, pm.sort_order, pm.id, pm.target_time
      FROM public.plan_meals pm
      WHERE pm.plan_id = v_active_plan_id
      ORDER BY pm.sort_order;
    ELSE
      INSERT INTO public.log_meals (daily_log_id, name, sort_order) VALUES
        (v_log_id, 'Café da manhã', 0),
        (v_log_id, 'Lanche da manhã', 1),
        (v_log_id, 'Almoço', 2),
        (v_log_id, 'Lanche da tarde', 3),
        (v_log_id, 'Jantar', 4),
        (v_log_id, 'Ceia', 5);
    END IF;
  END IF;

  RETURN v_log_id;
END
$function$
```

**Coisa importante:** o RPC já implementa o "cleanup-and-seed" baseado no
plano ativo — quando user tem plano ativo, novo daily_log copia automaticamente
as plan_meals como log_meals. **Isso significa que parte da Fase 5 do
blueprint já está pronta no DB**, só precisa de UI pra criar/ativar planos.

### Migrations versionadas

Pasta `supabase/migrations/` está ativa, com 1 migration aplicada:

```
20260506000000_fix_weight_logs_logged_on_default.sql
```

CLI já linkada — arquivos em `supabase/.temp/`:
- `linked-project.json`
- `project-ref`
- versões dos componentes

### Workflow `bunx supabase`

```powershell
# Confirmar CLI funcionando
bunx supabase --version    # → 2.98.0

# (uma única vez no início) Linkar projeto
bunx supabase link --project-ref <ref>

# Aplicar migrations na cloud (toda vez que tem .sql novo em migrations/)
bunx supabase db push

# Deploy Edge Functions (quando criar)
bunx supabase functions deploy <nome>
```

**Não precisa de Docker** pra trabalhar contra cloud. Docker só é
necessário pra `bunx supabase start` (Postgres local) — não usamos.

### Triggers

- `cleanup_plan_day_adjustments_on_entry_delete` — AFTER DELETE em
  `log_entries` com `is_off_plan=true`. Limpa adjustments correspondentes.
- `cleanup_plan_day_adjustments_on_meal_delete` — AFTER DELETE em `log_meals`.

(Ambos do V1 migrados. Relevantes pra Fase 6.)

### Dados em `foods`

591 TACO + 17 OFF cacheados do V1 (sem dono) + custom foods criadas em
teste pela conta `teste1@nutriplan.dev` (Whey + Pasta, possivelmente
outros depois de Fase 4 com banana/arroz/pão de teste).

### Deploy

- **Frontend:** Vercel auto-deploy de `main`
- **Backend:** Supabase prod (mesmo projeto do V1, schema migrado)
- **Sem staging.** Push é prod.

### Contas de teste

- `teste1@nutriplan.dev` — onboarding completo, custom foods + entries criados
- `teste2@nutriplan.dev` — onboarding completo

### Bundle atual

725KB minified / 203KB gzip (cresceu ~25KB na Fase 4 por causa de log/
feature). Warning de chunk size > 500KB acompanhando desde Fase 2.
**Não atacar agora** — code-splitting fica pra pendência P2.

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
│   ├── utils-format.ts          # formatadores pt-BR
│   └── dates.ts                 # getTodayBR, addDaysISO, formatDateDDMM, formatDateLongBR
├── types/
│   └── database.ts              # Supabase generated types (sempre fonte canônica)
├── components/
│   ├── ui/                      # shadcn primitivos
│   └── unit-input.tsx           # Input com unidade fixa + estado de edição
├── shared/
│   └── components/
│       └── bottom-nav.tsx       # tabs Hoje/Alimentos/Plano/Perfil
└── features/
    ├── auth/
    │   ├── context/auth-context.ts
    │   ├── components/auth-guard.tsx     # renderiza BottomNav após children
    │   ├── hooks/useAuth.ts              # ⚠️ camelCase (legado!)
    │   └── routes/{login,signup}.tsx
    ├── onboarding/...           # Fase 1-2
    ├── profile/...              # Fase 2
    ├── foods/                   # Fase 3
    │   ├── lib/{types,schemas,query-keys}.ts
    │   ├── hooks/use-*.ts       # kebab-case
    │   ├── components/*.tsx
    │   └── routes/*.tsx
    ├── log/                     # Fase 4 (NEW)
    │   ├── lib/{types,query-keys}.ts
    │   ├── hooks/use-*.ts       # useDailyLog, useDeleteEntry,
    │   │                       # useDeleteMeal, useCreateMeal, useAddEntry
    │   ├── components/          # DateNavigator, DailyProgressCard, CalorieRing,
    │   │                       # MacroBar, MealCard, EntryRow, LogRowMenu,
    │   │                       # NewMealDialog, AddFoodSheet,
    │   │                       # AddFoodMealPickerStep, AddFoodQuantityStep,
    │   │                       # FoodPickerRow
    │   └── routes/home.tsx      # / (Home autenticada / diário)
    └── plan/                    # Fase 5 (placeholder existe)
        └── routes/plan-placeholder.tsx    # /plano "Em breve"
```

### Padrões obrigatórios

**1. `useAuth` em camelCase, todos os outros hooks em kebab-case.**

`useAuth` é feature mais antiga (Fase 1) e ficou assim. Features novas
usam `use-profile`, `use-food-search`, `use-daily-log`, `use-add-entry` etc.

**2. Tipos do Supabase em `@/types/database`.**

NÃO `@/lib/database.types` (era o que eu chutei errado na primeira tentativa
da Fase 3). Fonte canônica do schema.

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

**5. Tipos gerados pelo Supabase NÃO têm nullability honesta em
nested selects e RPCs custom.**

A RPC `search_foods` retorna `brand: string` no tipo gerado, mas o banco
manda `null`. **Sempre criar tipos manuais** em `lib/types.ts` da feature
quando o resultado tem optional fields, e fazer `as unknown as MyType`
no boundary.

**Para nested selects** (ex: `useDailyLog` que faz `daily_logs.select(...,log_meals(...,log_entries(...,food:foods(...))))`):
- PostgREST devolve relacionamento many-to-one como **OBJECT**, não array.
  Confirmado em runtime na Fase 4 B7/B8. `entry.food` é objeto ou null,
  não array.
- Tipos gerados não capturam isso bem — tipar manualmente e cast.

**6. RLS está ativa em tudo. Não tentar contornar.**

Cada user só vê seus próprios `profiles`, `user_food_prefs`, `daily_logs`,
`log_meals`, `log_entries`, etc. Foods globais (TACO/OFF com `user_id IS
NULL`) são SELECT-only pra todos os users. Ownership via walker functions
(`get_daily_log_owner`, etc.) usadas pelas policies.

**7. Forms: pattern fixo com RHF v7 + zod v4 + shadcn `<Form>` + Sonner**

Padrão estabelecido em Fase 2 (`profile-edit.tsx`), Fase 3 (`food-new.tsx`)
e Fase 4 (`new-meal-dialog.tsx`):

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
  unions ou schemas com `.optional()` funcionarem.
- **NÃO usar `.transform()` no zod** — RHF v7 + zod v4 + discriminated union
  quebra. Normalização ('' → null, trim, etc) acontece no `mutationFn` do hook.
- **UnitInput passa string pro onCommit** — converter pra number explicitamente
  com `Number(v)` antes de `field.onChange(num)`. Esquecer essa conversão
  faz `zod.number()` falhar com "Expected number, received string" e o
  field fica vermelho mesmo com valor visualmente válido (bug do
  macro-editor calorias, descoberto e fixado na Fase 4).

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

Bug do B6 da Fase 3 (fix do toggleFavorite): violar isso quebra com `old.map
is not a function` quando o detail entra no cache.

**9. Query keys centralizadas em `lib/query-keys.ts` por feature**

```ts
export const foodKeys = {
  all: ['foods'] as const,
  search: (params) => ['foods', 'search', params] as const,
  detail: (id) => ['foods', 'detail', id] as const,
  hidden: () => ['foods', 'hidden'] as const,
}

export const logKeys = {
  all: ['log'] as const,
  daily: (dateISO) => ['log', 'daily', dateISO] as const,
}
```

Convenção: `feature.all` é o prefix maior pra invalidação ampla. Subseções
sempre como `['feature', 'subname', ...]` pra filter por predicate funcionar.

**10. Componentes shadcn que NÃO temos**

Ricardo NÃO tem `<Switch>`, `<Checkbox>`, `<Select>`, `<Dialog>`, `<Sheet>`,
`<DropdownMenu>`, `<Popover>`. Pra essas:

- **Checkbox** → `<input type="checkbox">` cru (vide profile-edit, food-form-fields)
- **Select** → `<RadioGroup>` (vide food-form-mode-select)
- **Dropdown** → implementação manual `div absolute` (vide food-row-menu,
  log-row-menu)
- **Dialog/Sheet** → div fixed inset-0 + backdrop + Esc + click-outside +
  body scroll-lock manual (vide new-meal-dialog, add-food-sheet)

Não sugerir instalar sem perguntar. Pattern manual é robusto e estabelecido.

**11. Padrão Sheet/Dialog mobile-first** (Fase 4 — B6, B7)

```tsx
<div
  className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
  onClick={() => onOpenChange(false)}
  role="dialog"
  aria-modal="true"
  aria-labelledby="title-id"
>
  <div
    className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-xl bg-background p-4 sm:rounded-xl"
    onClick={(e) => e.stopPropagation()}
  >
    {/* conteúdo */}
  </div>
</div>
```

- Mobile (< 640px): bottom-sheet com cantos arredondados no topo
- Desktop (≥ 640px): modal centralizado
- z-50 sobre BottomNav (z-20)
- Esc handler via `useEffect` enquanto open
- Body scroll-lock via `useEffect` enquanto open

**12. Padrão de menu manual ••• com click-outside** (Fase 3 — food-row-menu,
Fase 4 — log-row-menu)

```tsx
const [open, setOpen] = useState(false)
const containerRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  if (!open) return
  function handleClickOutside(event: MouseEvent) {
    if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
      setOpen(false)
    }
  }
  function handleEscape(event: KeyboardEvent) {
    if (event.key === 'Escape') setOpen(false)
  }
  document.addEventListener('mousedown', handleClickOutside)
  document.addEventListener('keydown', handleEscape)
  return () => {
    document.removeEventListener('mousedown', handleClickOutside)
    document.removeEventListener('keydown', handleEscape)
  }
}, [open])
```

Trigger é `<button>` com `aria-haspopup="true" aria-expanded={open}`,
preventDefault + stopPropagation no click pra não disparar o Link wrapper.

**13. BottomNav e `pb-24` em rotas autenticadas**

BottomNav é `fixed bottom-0 z-20 border-t bg-background`, ~57px de altura
(py-2 + icon h-5 + gap-1 + text-xs). Renderizada pelo `AuthGuard` após
`{children}`. **Toda rota autenticada precisa de `pb-24`** (96px) no
container raiz pra não ter conteúdo escondido atrás do nav.

```tsx
// auth-guard.tsx
return (
  <>
    {children}
    <BottomNav />
  </>
)
```

Aplicado em: home (/), foods, food-new, food-detail, food-edit, profile,
profile-edit, plan-placeholder. **Ao criar rota autenticada nova, lembrar
do `pb-24` no root container**.

**FAB elevado:** botão flutuante (ex: `/foods` tem "Criar alimento") usa
`fixed bottom-20 right-6` (80px) — `bottom-6` original caia em cima da
BottomNav (~24px). Pra novos FABs em rota autenticada, padronizar em
`bottom-20`.

**14. URL search params pra estado de busca**

Estado de busca em `/foods` (query + filter) mora em URL via
`useSearchParams`. Sobrevive a navegar pra detail e voltar (componente
desmonta + monta = useState perderia). Bônus: F5 preserva, link compartilhável.

```tsx
const [searchParams, setSearchParams] = useSearchParams()
const query = searchParams.get('q') ?? ''
const filter = ... // validar antes de cast

const setQuery = (v: string) => {
  const next = new URLSearchParams(searchParams)
  if (v) next.set('q', v); else next.delete('q')
  setSearchParams(next, { replace: true })  // ← replace evita encher histórico
}
```

`replace: true` é crítico — sem isso, cada keystroke adiciona uma entrada
no histórico do browser. Click num resultado real é navegação nova (sem
replace).

**15. Back nav preserva estado quando origem usa URL**

Botões "Voltar" em rotas filhas usam `navigate(-1)` (browser back) em vez
de `navigate('/parent')` — preserva search params, scroll position, etc.
da rota anterior.

Aplicado em food-detail.tsx (2 botões Voltar). **Quando criar nova rota
filha autenticada**, pensar nesse padrão.

Edge case: se user landar direto na rota filha (deep link), `navigate(-1)`
pode sair do app. Aceitamos — pequeno e BottomNav resolve.

**16. Snapshot pattern em `log_entries` e `daily_logs`**

`log_entries.kcal/protein/carbs/fat` são **computados no momento do log**
a partir de `food.{kcal,protein,carb,fat}_per_100g × quantity_g / 100`,
e gravados como snapshot. Editar o food depois NÃO muda entries antigas.

`daily_logs.*_target_snapshot` são **copiados de `profiles` no momento da
criação do daily_log** (pela RPC `get_or_create_daily_log`). Mudar profile
depois NÃO muda snapshots de dias passados. Mas **mudar profile hoje
NÃO atualiza o snapshot do daily_log de hoje automaticamente** — isso é
trabalho da Fase 5.7 do blueprint (não implementado, pendência P15).

**Sempre usar os snapshots pra display**, nunca recomputar a partir do
food atual.

**17. Date `daily_logs.log_date` em timezone BR**

A coluna `log_date` é `date` puro (sem timezone). Cliente é responsável
por mandar a data BR. Helper `getTodayBR()` em `src/lib/dates.ts` usa
`Intl.DateTimeFormat('en-CA', {timeZone: 'America/Sao_Paulo'})` pra
gerar `YYYY-MM-DD` em BR.

`weight_logs.logged_on` tem default server-side `(now() AT TIME ZONE
'America/Sao_Paulo')::date` (migration 8.5). `daily_logs.log_date` não
tem default — cliente sempre passa explícito.

### Estilo de comentário

Código tem comentários PORTUGUESES, explicativos, sobre **decisões** (não
sobre "o que o código faz"). Padrão de docs internas: bloco no topo do
arquivo explicando *por quê*, comentário inline quando tem decisão sutil.

Exemplos válidos:
- "RHF v7 + zod v4 + discriminated union interage mal com transforms"
- "Cast intencional: tipo gerado não preserva nullability"
- "Storage em múltiplo de 0.25 — round-trip g↔% sem drift visível"
- "Mutation no parent porque MealCard desmonta em delete optimistic"

---

## 4. SCHEMA DO BANCO (CHEAT SHEET)

### Tabela `daily_logs`

```
id                       uuid PK
user_id                  uuid NOT NULL
log_date                 date NOT NULL              ← NÃO "logged_on"
plan_id                  uuid? FK meal_plans
calorie_target_snapshot  integer?
protein_target_snapshot  integer?
carb_target_snapshot     integer?
fat_target_snapshot      integer?
created_at               timestamptz NOT NULL DEFAULT now()
```

UNIQUE `(user_id, log_date)`. RLS: own rows only (walker
`get_daily_log_owner`).

### Tabela `log_meals`

```
id              uuid PK
daily_log_id    uuid NOT NULL FK daily_logs (ON DELETE CASCADE)
name            text NOT NULL
sort_order      integer NOT NULL
plan_meal_id    uuid? FK plan_meals      ← NULL = manual; set = veio do plano
target_time     time?
eaten_at        timestamptz?
created_at      timestamptz NOT NULL
```

### Tabela `log_entries`

```
id               uuid PK
log_meal_id      uuid NOT NULL FK log_meals (ON DELETE CASCADE)
food_id          uuid NOT NULL FK foods
quantity_g       numeric NOT NULL
kcal             numeric NOT NULL    ← snapshot computado no log
protein          numeric NOT NULL    ← snapshot
carbs            numeric NOT NULL    ← snapshot
fat              numeric NOT NULL    ← snapshot
plan_slot_id     uuid? FK plan_slots
plan_option_id   uuid? FK slot_options
is_off_plan      boolean NOT NULL DEFAULT false
created_at       timestamptz NOT NULL
```

### Tabela `foods`

```
foods (
  id uuid PK,
  user_id uuid? FK,                -- NULL = global (TACO ou OFF cache)
  source text CHECK IN ('taco','open_food_facts','custom','composite'),
  external_id text?,
  name text NOT NULL,
  brand text?,
  category text?,
  kcal_per_100g, protein_per_100g, carb_per_100g, fat_per_100g numeric NOT NULL,
  fiber_per_100g, sodium_mg_per_100g, sugar_per_100g, saturated_fat_per_100g numeric?,
  default_serving_g numeric NOT NULL DEFAULT 100,
  serving_label text?,
  yield_weight_g numeric?,         -- só pra source='composite'
  macros_manually_overridden boolean,
  is_archived boolean,
  recalc_whole_units_only boolean NOT NULL DEFAULT false,
  created_at timestamptz
)
UNIQUE(source, external_id) WHERE external_id IS NOT NULL
```

RLS insert do V1:
```sql
WITH CHECK (
  user_id = auth.uid()
  OR (
    user_id IS NULL
    AND source = 'open_food_facts'
    AND external_id IS NOT NULL
    AND external_id ~ '^\d{8,14}$'
  )
)
```

### Tabela `profiles`

```
profiles (
  id uuid PK REFERENCES auth.users,
  display_name text, sex text, birth_date date,
  height_cm numeric, weight_kg numeric,
  activity_level enum, goal enum,
  calorie_target int?, protein_target int?, carb_target int?, fat_target int?,
  onboarding_completed boolean DEFAULT false,
  created_at, updated_at timestamptz
)
```

**Sobre tipo dos targets:** suspeita aberta — pode ser `integer` (que
trunca decimal no save) ou `numeric` (preserva). Macro-editor da Fase 4
aceita decimais (múltiplos de 0.25 vindos de round-trip %↔g). Se for
`integer`, há drift potencial após reload (ver pendência P13).

### Tabelas de plan (Fase 5+)

```
meal_plans (
  id uuid PK, user_id uuid FK,
  name text NOT NULL, is_active boolean,
  created_at, updated_at
)
UNIQUE partial (user_id) WHERE is_active = true  ← 1 ativo por user

plan_meals (
  id uuid PK, plan_id uuid FK,
  name text, sort_order int, target_time time?
)

plan_slots (
  id uuid PK, meal_id uuid FK,    ← coluna se chama `meal_id`, não `plan_meal_id`
  label text?, sort_order int
)

slot_options (
  id uuid PK, slot_id uuid FK,
  sort_order int
)

option_items (
  id uuid PK, option_id uuid FK,
  food_id uuid FK foods,
  quantity_g numeric
)
```

`plan_day_adjustments`: registra escolhas pontuais que divergem do plano
sem alterá-lo. Usada pela Fase 6 (substituição). Schema:

```
plan_day_adjustments (
  id uuid PK,
  user_id uuid FK,
  adjustment_date date,
  plan_id, plan_meal_id, plan_slot_id,
  plan_option_id, option_item_id uuid (all NOT NULL),
  adjusted_quantity_g numeric CHECK >= 0,
  UNIQUE(user_id, adjustment_date, option_item_id)
)
```

### Tabela `composite_food_items`

```
composite_food_items (
  id uuid PK,
  composite_food_id uuid FK foods (food de source='composite'),
  ingredient_id uuid FK foods (food ingrediente),
  quantity_g numeric,
  sort_order int
)
```

Pra Fase futura (P6 do STATUS): UI pra criar receita composta. Schema
pronto, lógica de cálculo de macros existe (V1), só falta UI.

### Tabela `user_food_prefs`

```
user_food_prefs (
  id uuid PK,
  user_id uuid, food_id uuid,
  is_favorite boolean,
  is_hidden boolean NOT NULL DEFAULT false,
  use_count int NOT NULL DEFAULT 0,
  last_used timestamptz?
)
UNIQUE(user_id, food_id) ← upsert com onConflict='user_id,food_id'
```

`use_count` e `last_used` **não são incrementados automaticamente em log**
(ver pendência P12). Filtros "Frequentes" e "Recentes" em `/foods` ficam
inativos pra alimentos que o user só logou — funcionam só pra alimentos
que ele favoritou/desfavoritou (manipulação manual via UI).

### Tabela `weight_logs`

```
weight_logs (
  id uuid PK, user_id uuid, weight_kg numeric,
  logged_on date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date
)
UNIQUE(user_id, logged_on)
```

Default BR via migration 8.5 (do V1).

### RPC `search_foods` (revisar antes de Fase 5)

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
Rotas: `/` (atualmente Home autenticada, pós-Fase 4), `/login`, `/signup`.
Trigger `handle_new_user` validado: signup cria row em `auth.users` E
em `public.profiles`.

Provider tree: `StrictMode → QueryClient → AuthProvider → App`.

---

## 7. FASE 2 — FECHADA ✅ (recap mínimo)

Onboarding multi-step + BMR/TDEE/macros + persistência + `/profile`
readonly + `/profile/edit` com MacroEditor dual-mode (g/%) + AuthGuard
v2 (sem user → /login; sem onboarding → /onboarding; pronto → children).
2 contas validadas em prod.

**Padrões críticos estabelecidos aqui** (usados nas Fases 3-4 também):
- `useForm` com generic Output explícito pra zod com optional/transform
- `MacroEditor` source-of-truth em gramas, modo controla display
- `UnitInput` (agora em `src/components/unit-input.tsx` desde Fase 4)
  com string em edição local (evita pulo de casa decimal)
- Migration 8.5 hardcoda timezone BR no default de `weight_logs.logged_on`

**Refinamento do MacroEditor em Fase 4 (B7):**
- Storage em múltiplo de 0.25 (round-trip g↔% sem drift visível)
- Em modo %, mudar calorias escala todos os macros pra preservar %s
  (modelo mental "%s são fixos")
- Calorias parse de string → number explícito no onCommit (sem isso,
  zod.number() falha)

---

## 8. FASE 3 — FECHADA ✅ (recap detalhado)

### Entrega final

Rota `/foods` com:
- **Busca ranqueada** TACO + custom + composite (com 7 filtros pills)
- **Estrela** pra favoritar com optimistic update
- **Menu •••** com "Ocultar" + toast undo de 5s
- **FAB** `+` pra criar custom food
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
| B7+B8 | OFF API integration (REVERTED — ver §11/P1) | — |
| B9 | Hide foods + undo + profile section | 874b1be |

### Aditivos da Fase 4 que tocaram em arquivos da Fase 3

- **`food-row.tsx`** ganhou:
  - Botão "+" pra logar (props `onAdd: (food) => void`)
  - Imports atualizados (Plus icon)
- **`food-results-list.tsx`** ganhou:
  - Prop `onAdd: (food) => void` pass-through
- **`food-detail.tsx`** mudou:
  - 2 botões "Voltar" agora usam `navigate(-1)` em vez de `navigate('/foods')`
    (preserva busca da rota anterior)
  - `pb-24` adicionado em todos os containers (clearance pra BottomNav)
- **`food-new.tsx`** e **`food-edit.tsx`**: `pb-24` adicionado.
- **`foods.tsx`** ganhou:
  - `useSearchParams` substitui useState pra `query` e `filter`
  - `useDailyLog` + `useAddEntry` (mutation no parent — Regra 14)
  - `AddFoodSheet` renderizada no fim
  - FAB elevado de `bottom-6` pra `bottom-20`

### Decisões importantes

**1. Tipos do Supabase para `search_foods` retornam SEM nullability.**

Workaround: criamos `FoodSearchResult` em `lib/types.ts` com nullability
honesta. Cast `as unknown as FoodSearchResult[]` no hook.

**2. Filtro `'all'` da `search_foods` exclui OFFs não-usados.**

Comportamento intencional do SQL. Pra ver OFFs cacheados, filtro `'off'`.

**3. RHF v7 + zod v4 + discriminated union NÃO funciona com `.transform()`.**

Solução: remover `.transform()` do schema, normalizar no `mutationFn` do
hook, tipar `useForm<Input, unknown, Output>` com 3 generics.

**4. Cache híbrido (search array + detail object) sob mesmo prefix.**

`foodKeys.all = ['foods']` cobre `['foods','search',...]` (array) e
`['foods','detail',id]` (objeto). `setQueriesData` ingênuo quebra com
`.map is not a function`. Solução: predicate por `queryKey[1]`.

**5. FAB (Floating Action Button) é padrão mobile-first do app.**

`fixed bottom-20 right-6 z-10` com ícone `Plus`. (Foi `bottom-6`
originalmente, subiu pra clear o BottomNav adicionado na Fase 4.)

**6. Edit usa SEMPRE per-100g (não dual-mode).**

Banco guarda canônico per-100g. Reverter pra "Por porção" tem ambiguidade.

**7. Menu ••• implementado MANUAL (não shadcn DropdownMenu).**

Evitou instalar `@radix-ui/react-dropdown-menu`. Padrão se estabilizou
na Fase 4 também (LogRowMenu).

**8. Toast com undo de 5s usando `action` do Sonner.**

Padrão moderno (Gmail / Material Design). 5s é window confortável.

---

## 9. FASE 4 — FECHADA ✅ (DETALHADO — fase recém-fechada)

### Entrega final

Diário diário (`/`) com:
- **DateNavigator** sticky no topo: `◀ 📅 Hoje, 13 de maio ▶`
  - Formato V1: "Hoje, DD de [mês]" quando é hoje; "DD de [mês]" outros dias
  - Bloqueia navegação pra futuro (evita criar daily_logs vazios)
  - Click no centro volta pra hoje
- **DailyProgressCard**: ring kcal SVG (zero KB extra de bundle) +
  3 barras horizontais (Proteína violeta, Carbo âmbar, Gordura rosa) +
  "Restante: X kcal" no rodapé. Cores do ring por convenção:
  - < 95% azul, 95-105% verde, 105-115% âmbar, > 115% vermelho
- **MealCards**: uma por log_meal. Header com nome + badge "Do plano"
  (condicional em `plan_meal_id != null`, Fase 5+) + menu ••• com
  "Excluir refeição". Lista de entries com nome + "Xg · Y kcal" + menu •••
  com "Excluir". Footer com "+ Adicionar alimento" inline.
- **"+ Adicionar refeição"** abaixo da lista — abre NewMealDialog
- **AddFoodSheet** (sheet 2 steps):
  - Step 1 (meal picker): radio das log_meals do dia
  - Step 2 (quantity): busca alimento + preview macros + qty input (`UnitInput`)
- **BottomNav** sticky: Hoje (/) / Alimentos (/foods) / Plano (/plano) / Perfil (/profile)
- **/plano** placeholder ("Em breve") — Fase 5 substitui pelo today's plan view
- **/foods** ganhou "+" pra logar direto (sheet abre na meal picker, food já escolhido)
- **/foods** preserva busca/filtro em URL via `useSearchParams` (back nav natural)

### Blocos executados

| Bloco | Conteúdo | Commit |
|---|---|---|
| B1 | RPC `get_or_create_daily_log` inspecionada — já existia no banco fazendo MAIS do que o blueprint previa (seeda log_meals com plano ativo ou 6 defaults BR) | — (sem migration nova) |
| B2 | useDailyLog hook + scaffold log/ (types, query-keys) | 14a308f |
| B3 | Home `/` + DateNavigator + cleanup /dashboard (12 arquivos) | 3f6030e |
| B3.5 | BottomNav + header V1 format + /plano placeholder + pb-24 em rotas autenticadas | bb26862 |
| B4 | DailyProgressCard com ring SVG + barras macros | 4107d80 |
| B5 | MealCard + EntryRow + LogRowMenu + deletes optimistic com mutations no parent (Regra 14 nasceu aqui) | 1de27b8 |
| B6 | NewMealDialog (criar refeição manual) | a5d5d89 |
| B7 | AddFoodFlow completo (sheet 2 steps) + useAddEntry + UnitInput extraído + macro-editor fixes (parse calorias, drift, rescale) | db21e56 |
| B8 | Logar via /foods + preservar busca na back nav + FAB acima do BottomNav | 9bf5779 |

### Decisões importantes da Fase 4

**1. RPC `get_or_create_daily_log` já existia + fazia mais que o blueprint.**

A versão que está no banco (definida em §2 deste STATUS) **semeia
automaticamente as `log_meals`** quando cria um daily_log novo:
- Se user tem plano ativo: copia plan_meals como log_meals
- Se não: insere 6 refeições padrão em pt-BR (Café da manhã, Lanche da
  manhã, Almoço, Lanche da tarde, Jantar, Ceia)

Isso significa que **parte da Fase 5 (cleanup-and-seed) já está pronta**
no DB. O trabalho da Fase 5 é UI pra criar/ativar planos.

Aprendido também: outras RPCs marcadas como "por criar" pelo STATUS antigo
já existiam (`activate_meal_plan`, `get_plan_tree`, ownership walkers).
**Regra 13** capturada — sempre verificar `database.ts`.

**2. Navegação V1: BottomNav fixed no rodapé, header simples.**

V1 (screenshot que Ricardo enviou na B3) tem header **só** com
DateNavigator centralizado entre setas, sem botões "Alimentos"/"Perfil".
Navegação primária é via BottomNav. Adotamos esse padrão em B3.5.

**3. App vai ser nativo (não PWA).**

Decisão estratégica registrada em §0. Implicação: Fase 6 do blueprint
("PWA") é reformulada como "preparar pra Capacitor" no futuro. Não
gastamos esforço em service worker / manifest PWA / install prompt.

**4. Optimistic updates + delete-self pattern.**

Quando uma mutation faz optimistic update que REMOVE o próprio componente
(ex: deletar uma MealCard), o componente desmonta antes do server responder
e TanStack Query v5 dropa os callbacks (`onSuccess`/`onError`). Solução:
mutations vivem no parent (`HomePage`), filhos recebem handlers como
props. **Capturado como Regra 14**.

Implementado em:
- `home.tsx`: useDeleteEntry, useDeleteMeal, useCreateMeal, useAddEntry
- `foods.tsx`: useAddEntry (mesmo problema com FoodRow após search rebuild)

**5. URL search params pra preservar estado em /foods.**

Pra resolver "busca some ao voltar do detail" (pendência do V1), mudei
`useState` por `useSearchParams` em foods.tsx. `replace: true` evita
encher histórico ao digitar. Combinado com `navigate(-1)` nos botões
"Voltar" do food-detail, back nav natural funciona.

**6. macro-editor 3 fixes da Fase 2 reaparecendo:**

Bugs antigos surgidos ao testar o B7. Todos consertados em `macro-editor.tsx`:

a) **Calorias parse:** `onCommit` passava string pra `field.onChange`,
   zod.number() falhava. Fix: parse `Number(v)` explícito.

b) **Drift 0.1pp em modo %:** digitar 30% mostrava 30.1% depois do commit.
   Causa: round-trip g↔% com `Math.round` em gramas perde precisão. Fix:
   storage em **múltiplo de 0.25** (`roundToQuarter`) — preserva %s
   exatos pra macros ×4 (prot/carbo), drift sub-0.05pp pra ×9 (gordura)
   invisível com `toFixed(1)`.

c) **Modelo mental quebrado:** em modo %, mudar calorias deixava %s
   "deformados" porque gramas eram source of truth. Fix: quando user
   commita nova calorias em modo %, escalar todos os macros pelo ratio
   `newKcal/oldKcal` pra preservar %s.

Side effect: storage pode ter decimais (218.75g de proteína). Se a
coluna do DB for `integer`, decimais truncam. Veja pendência P13.

**7. Default meals em pt-BR fluem da RPC.**

Quando user não tem plano ativo, abrir Home cria daily_log + 6 refeições
padrão (RPC `get_or_create_daily_log`). Ricardo confirmou que prefere
manter assim (vs reduzir pra 3 ou começar com 0). Diff vs blueprint:
blueprint sugeria "começar vazio + B6 cria manual". Ajuste capturado.

**8. PostgREST nested select devolve many-to-one como OBJECT.**

Confirmado em runtime na Fase 4: `entry.food` é objeto único (ou null),
não array de 1 elemento. Tipagem foi corretamente preditiva (`food:
EntryFoodSummary | null` em types.ts).

### Estrutura final da feature `log`

```
src/features/log/
├── lib/
│   ├── types.ts             # DailyLog, LogMeal, LogEntry, LogMealWithEntries,
│   │                       # LogEntryWithFood, EntryFoodSummary, DayTotals,
│   │                       # DailyLogPayload
│   └── query-keys.ts        # logKeys.{all, daily}
├── hooks/
│   ├── use-daily-log.ts     # RPC + nested SELECT + reshape + totals
│   ├── use-delete-entry.ts  # optimistic + rollback
│   ├── use-delete-meal.ts   # optimistic + rollback
│   ├── use-create-meal.ts   # optimistic + sort_order max+1
│   └── use-add-entry.ts     # optimistic + snapshot de macros
├── components/
│   ├── date-navigator.tsx           # ◀ 📅 Hoje, 13 de maio ▶
│   ├── calorie-ring.tsx             # SVG manual arco horário
│   ├── macro-bar.tsx                # barra horizontal com cor por macro
│   ├── daily-progress-card.tsx      # ring + 3 barras + restante
│   ├── meal-card.tsx                # card de uma refeição
│   ├── entry-row.tsx                # row de um alimento dentro
│   ├── log-row-menu.tsx             # ••• manual reusável (meal + entry)
│   ├── new-meal-dialog.tsx          # dialog manual (RHF + zod)
│   ├── add-food-sheet.tsx           # wrapper 2-step
│   ├── add-food-meal-picker-step.tsx # step 1 (radio meals)
│   ├── add-food-quantity-step.tsx   # step 2 (search + qty + preview)
│   └── food-picker-row.tsx          # row simplificada pra picker
└── routes/
    └── home.tsx                     # / autenticada (orchestra tudo)
```

### Lições da Fase 4 (NÃO REPETIR)

**Erro 1 — Confiar no STATUS sobre RPCs sem verificar database.ts.**

STATUS dizia "RPCs não migradas: get_or_create_daily_log, activate_meal_plan,
get_plan_tree". Na verdade já existiam. Custou 2 round-trips de SQL com
Ricardo pra descobrir o body real da `get_or_create_daily_log`. **Solução:
Regra 13 + sempre conferir database.ts seção Functions antes de propor
migration.**

**Erro 2 — Mutations no componente que desmonta.**

B5 testou delete de refeição, toast não aparecia. Diagnóstico: TanStack
Query v5 dropa callbacks no unmount. **Solução: Regra 14 + mutations no
parent quando há optimistic delete-self.**

**Erro 3 — UnitInput passa string, esquecer parse pra number.**

B7 + macro-editor: campo calorias virou vermelho ao salvar. Causa: `onCommit`
recebia string '2500', `field.onChange('2500')` (string), zod.number() falhava.
**Sempre converter `Number(v)` antes de field.onChange quando vem do UnitInput.**

**Erro 4 — Math.round em ponte de conversão de unidades.**

B7 macro-editor: drift de 0.1pp em modo %. Causa: round-trip g↔% com
`Math.round` no gramas. **Pra conversões com round-trip, evitar round
agressivo. Usar granularidade que casa com os fatores (0.25g pra macros
×4 ou ×9 funciona bem).**

**Erro 5 — Auth do SQL Editor diferente do app.**

B1 da Fase 4: `auth.uid()` em SQL queries direto retornou NULL, causando
falso negativo (count = 0 meals criadas). **Solução: usar `pg_get_functiondef`
e queries sem dependência de auth.uid() ao validar RPCs no SQL Editor.**

---

## 10. ANTI-PADRÕES OBSERVADOS (PRA NÃO REPETIR)

### A1. Chutar antes de pesquisar

Quando enfrentar problema de API externa, biblioteca, comportamento
inesperado de framework: **`web_search` primeiro, código depois**. Custa
1 tool call e pode salvar várias mensagens.

### A2. Entregar 8 arquivos sem distinção visual de novos vs editados

Solução: Regra 8.

### A3. Assumir caminhos de arquivo sem confirmar

No início da Fase 3 chutei `src/lib/database.types.ts` quando o real era
`src/types/database.ts`. Solução: pedir mapa antes de codar bloco grande.

### A4. Otimismo sobre encoding silencioso

Quando Ricardo mostra arquivo com mojibake no `Get-Content`, **isso é
visual, não bug**. Pra confirmar: `Get-Content X -Encoding UTF8`.

### A5. Pular validação manual e tentar pular pra próximo bloco

Validação manual é por bloco, não opcional.

### A6. Sugerir Edge Function / Docker / Supabase CLI sem confirmar setup

**Estado atualizado:** CLI já está. Docker NÃO está (e não precisa pra
trabalho contra cloud). Edge Function requer só `bunx supabase functions
deploy`. Regra 10 ajustada com esse conhecimento.

### A7. Confiar em "X não existe" do STATUS sem verificar (NOVO Fase 4)

STATUS pode estar desatualizado. `database.ts` é fonte canônica pro
schema. Sempre verificar antes de propor `CREATE FUNCTION` ou migration
nova. Regra 13.

### A8. Mutations em componente que desmonta (NOVO Fase 4)

Optimistic delete-self quebra callbacks. Regra 14.

### A9. Math.round em round-trip de unidades (NOVO Fase 4)

Round-trip g↔% com `Math.round` no gramas perde precisão e gera drift
visível. Pra macros, usar `roundToQuarter` (múltiplo de 0.25) ou storage
decimal.

---

## 11. PENDÊNCIAS ABERTAS (prioridade alta primeiro)

### P1 — Open Food Facts: integração via Edge Function (alta)

**Contexto:** B7+B8 da Fase 3 foi revertido. O `cgi/search.pl` da OFF está
retornando 503 globalmente desde abr/2026 (issue documentado:
github.com/CodeWithCJ/SparkyFitness/issues/1079). A v2 search não faz
full-text. A solução real é Search-a-licious via proxy server-side.

**Bloqueador real (atualizado):** apenas escrever a Edge Function +
deploy. CLI já está instalada via `bunx supabase`. Docker NÃO é
necessário pra deploy.

**Quando atacar:** depois da Fase 5 ou paralelo. Não bloqueia uso atual.

**Como atacar:**
1. Criar Edge Function `off-search` em `supabase/functions/off-search/index.ts`
2. Proxy pra `search.openfoodfacts.org` (Search-a-licious) com User-Agent
   customizado e filter de `countries_tags=en:brazil`
3. Cliente JS chama Edge Function via `supabase.functions.invoke('off-search', ...)`
4. Deploy via `bunx supabase functions deploy off-search`
5. Reintroduzir os 5 arquivos que apaguei no revert (off-api.ts, off-cache.ts,
   ui de OFF na busca, etc.)

**Estimativa:** 1-2 dias dependendo de complexidade da Edge Function.

### P2 — Bundle size warning (média)

725KB / 203KB gzip. Foge do limite recomendado de 500KB. Code-splitting
via `React.lazy` por rota resolve. Atacar pré-publicação ou Capacitor prep.

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

Composite foods já existem no banco mas UI pra criar não. Atacar quando
user pedir ou após Fase 6.

### P7 — Service workers / PWA install (OBSOLETO)

**App vai ser nativo, não PWA.** Pendência redefinida: prep pra Capacitor
no futuro. Manifest e SW deixam de fazer sentido isolados.

### P8 — Sessão / JWT longevity, email confirmation em prod

Acumulado: JWT default 1h (ok em dev), email confirmation desligado em
dev. Decidir ativar email confirmation **antes da publicação** (Apple/Google
Store provavelmente exigem). Atacar pré-publicação.

### P9 — Transação real no submit do onboarding (baixa)

`use-complete-onboarding` faz 2 chamadas separadas (UPDATE profile + INSERT
weight_log). Risco baixo, raramente falha. Considerar atomizar quando
houver caso real.

### P10 — MacroEditor mora em `onboarding/components/`

Mas é usado em /profile/edit também. Refactor pra `@/components/` quando
virar caso maior. UnitInput já foi extraído na Fase 4 — mesmo padrão.

### P11 — Rota 404 explícita (baixa, pós-MVP)

Hoje React Router v6 sem `<Route path="*">` mostra página em branco em
rotas inexistentes. Adicionar componente NotFound simples + rota catch-all.
Decidido com Ricardo: pós-MVP, junto com prep pra publicação. Não bloqueia.

### P12 — `user_food_prefs.use_count` não incrementa em log (média)

Filtros "Frequentes" e "Recentes" em `/foods` ficam estáticos pra alimentos
que o user só logou. Implementar increment atômico via RPC:

```sql
CREATE OR REPLACE FUNCTION public.bump_food_use(p_food_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO user_food_prefs (user_id, food_id, use_count, last_used)
  VALUES (auth.uid(), p_food_id, 1, now())
  ON CONFLICT (user_id, food_id)
  DO UPDATE SET use_count = user_food_prefs.use_count + 1,
                last_used = now();
END $$;
```

Depois chamar `supabase.rpc('bump_food_use', { p_food_id })` no `useAddEntry`
após sucesso do INSERT em log_entries. Atacar quando filtros "Frequentes"
incomodarem o user.

### P13 — Drift de macros em modo % após reload (suspeita aberta)

**Cenário:** user edita perfil em modo %, digita 35% / 50% / 15% pra
proteína/carbo/gordura. Storage é múltiplo de 0.25 (218.75g, 312.5g,
41.75g). Salva. Se a coluna `profiles.protein_target` for `integer` no
DB, 218.75 vira 218 ao salvar. Reload do form vai mostrar (218*4/2500)*100
= 34.88% → "34.9%" — drift visível.

**Se coluna for `numeric`:** sem drift, storage preserva 218.75.

**Pra confirmar:** rodar no SQL Editor:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name='profiles'
  AND column_name LIKE '%_target%';
```

Se for `integer`, opção: migrar pra `numeric` ou aceitar drift mínimo
(0.1pp), ou implementar storage de % em vez de gramas (refactor grande
no macro-editor). Decidir quando user reclamar.

### P14 — Edit plano ativo NÃO ressincroniza today automático (Fase 5 do blueprint)

Quando user edita plano ativo após já ter daily_log de hoje criado,
log_meals atual fica out-of-sync. Solução: chamar `activate_meal_plan`
de novo após save de plano ativo (idempotente, cleanup-and-seed).
**Implementar na Fase 5 dentro do save de plan-edit (B5 da Fase 5).**

### P15 — Profile change NÃO atualiza target snapshot de hoje (Fase 5 do blueprint)

Snapshot é congelado na criação do daily_log. Mudar profile depois não
afeta hoje. Sub-fase 4.7 do blueprint. **Implementar na Fase 5** ou
adiar (impacto pequeno — user pode deletar daily_log de hoje pra forçar
recriar).

---

## 12. PRÓXIMA FASE — FASE 5 DO PROJETO (Planos Alimentares)

⚠️ **Atenção à renumeração:** o blueprint chama "Fase 4 — Planos" o que
chamamos no projeto de "Fase 5". Estamos usando STATUS-numbering, não
blueprint-numbering. Fase 5 do projeto == Fase 4 do blueprint, Parte 7.

### Entrega da Fase 5 (escopo decidido com Ricardo)

**MVP completo com hierarquia plena** — incluindo OR alternatives.
Decisão de não simplificar pra garantir Fase 6 (motor de substituição)
sem refactor depois.

Telas:
- **`/planos`** — lista dos meus planos com badge "ativo" + ações (ativar,
  editar, deletar)
- **`/planos/novo`** — form criar plano (nome) → redirect pra editar
- **`/planos/:id/editar`** — editor tipo tree expandível (V1 style):
  refeições → slots → options (OR) → items (food + qty)
- **`/plano`** (singular, tab do BottomNav) — substituir placeholder pela
  view real do plano ativo aplicado a hoje (read-only)

### Plano de blocos (6 blocos)

**B1 — Foundation: tipos + lista + ativar + deletar** (M)

🆕 Novos:
- `src/features/plans/lib/types.ts` — `MealPlan`, `PlanMealRow`, `PlanSlotRow`,
  `SlotOptionRow`, `OptionItemRow`, `PlanTree` (resultado da RPC `get_plan_tree`)
- `src/features/plans/lib/query-keys.ts` — `planKeys.{all, list, detail, tree}`
- `src/features/plans/hooks/use-meal-plans.ts` — lista do user (com is_active)
- `src/features/plans/hooks/use-activate-plan.ts` — RPC `activate_meal_plan`
  + invalidate `logKeys.daily(hoje)` (ativar muda diário de hoje via cleanup-and-seed)
- `src/features/plans/hooks/use-delete-plan.ts` — DELETE em meal_plans (cascade)
- `src/features/plans/routes/plans.tsx` — `/planos` lista com badge "ativo" + ações

📝 Editados:
- `src/App.tsx` — rota `/planos`

Notas:
- Reusar BottomNav (já existe)
- `pb-24` no container raiz

**B2 — Create plan vazio** (S)

🆕 Novos:
- `src/features/plans/hooks/use-create-plan.ts` — INSERT em meal_plans
- `src/features/plans/routes/plan-new.tsx` — form (nome) → após save,
  `navigate('/planos/:id/editar', { replace: true })`

📝 Editados:
- `src/App.tsx` — rota `/planos/novo`

**B3 — Plan editor: arquitetura draft + refeições** (M)

🆕 Novos:
- `src/features/plans/lib/draft-types.ts` — tipos de draft com client UUIDs:
  - `MealDraft` { id (real ou `draft-uuid`), name, target_time?, sort_order,
    slots: SlotDraft[] }
  - `SlotDraft` { id, label?, sort_order, options: OptionDraft[] }
  - `OptionDraft` { id, sort_order, items: ItemDraft[] }
  - `ItemDraft` { id, food_id, quantity_g }
- `src/features/plans/hooks/use-plan-editor.ts`:
  - Fetch original via `supabase.rpc('get_plan_tree', { p_plan_id })`
  - Deep-clone original pra draft (mutavel)
  - Mutadores: `addMeal`, `removeMeal`, `updateMeal(id, patch)`, `moveMeal(id, dir)`
- `src/features/plans/routes/plan-edit.tsx` — header (nome editável) +
  lista de refeições + botão "+ Adicionar refeição"
- `src/features/plans/components/meal-editor-card.tsx` — card expandível:
  - Collapsed: nome + horário + lixeira
  - Expanded: corpo com slots (vazio inicialmente, B4 popula)

📝 Editados:
- `src/App.tsx` — rota `/planos/:id/editar`

**B4 — Plan editor: slots + options + items dentro de refeição** (L) — **bloco mais denso**

🆕 Novos:
- `src/features/plans/components/slot-editor.tsx` — card de slot dentro
  do meal-editor-card. Label opcional, lista de options
- `src/features/plans/components/option-editor.tsx` — option dentro do slot.
  Render "Opção 1" / "Opção 2" / "OU" entre options. Lista de items
- `src/features/plans/components/item-editor.tsx` — row do item:
  picker de food + UnitInput de qty + remove

📝 Editados:
- `use-plan-editor.ts` — estender com mutadores pra slots/options/items:
  `addSlot(mealId)`, `addOption(slotId)`, `addItem(optionId)`,
  `removeSlot`, `removeOption`, `removeItem`, `updateItem(id, patch)`, etc.

Reusos:
- `useFoodSearch` da Fase 3 pra picker de food (provavelmente dentro de
  um Sheet manual reusando o pattern do AddFoodSheet — ou um novo
  `FoodPickerSheet` desacoplado)
- `UnitInput` (já em `@/components/`)

**B5 — Save com diff FK-safe + validações** (M)

🆕 Novos:
- `src/features/plans/lib/diff.ts`:
  - `computeDiff(original: PlanTree, draft: PlanTreeDraft)` →
    `{ creates: {meals, slots, options, items}, updates: {...}, deletes: {...} }`
  - Detecção: id começa com `draft-` → CREATE. id real + valor mudou → UPDATE.
    id real em original mas não em draft → DELETE.
- `src/features/plans/hooks/use-save-plan.ts`:
  - Executar em ordem FK-safe:
    1. **Inserts top-down:** plan_meals → plan_slots → slot_options → option_items
       (cada nível precisa do ID real do pai pra inserir filhos — mapear
       `draft-uuid → real-uuid` ao longo do save)
    2. **Updates:** any order
    3. **Deletes bottom-up:** option_items → slot_options → plan_slots → plan_meals
  - Empty-slot validation: throw `EmptySlotError` com nome do slot se há
    slot sem options ou option sem items
- (opcional) `src/features/plans/lib/errors.ts` — `EmptySlotError` class

📝 Editados:
- `plan-edit.tsx` — botão "Salvar" chama `useSavePlan.mutate(diff)`,
  trata erro de validação com toast específico

Notas:
- Se plano salvo é ATIVO, no `onSuccess` do save chamar
  `useActivatePlan.mutate(planId)` pra ressincronizar today (resolve P14)
- Toast condicional: "Plano salvo" ou "Plano salvo e sincronizado com hoje"

**B6 — `/plano` route real (today's plan view)** (M)

🆕 Novos:
- `src/features/plans/hooks/use-todays-plan.ts`:
  - Combina `useDailyLog(hoje)` + `supabase.rpc('get_plan_tree',
    { p_plan_id: dailyLog.plan_id })` se há plano ativo
  - Retorna `{ planTree, todayLog, hasActivePlan, loading, error }`
- `src/features/plans/routes/plano.tsx`:
  - Estado "sem plano ativo": "Nenhum plano ativo. [Criar plano]" → /planos/novo
  - Estado "com plano": header (nome do plano + link "Meus planos" → /planos) +
    lista de refeições com items planejados (read-only)
- `src/features/plans/components/plan-meal-readonly.tsx` — card de refeição
  do plano (não confundir com `meal-editor-card` que é editável)

📝 Editados:
- `src/App.tsx` — `/plano` aponta pra `plano.tsx` (não placeholder)
- Deletar `src/features/plan/routes/plan-placeholder.tsx`

Out of scope (Fase 6+):
- 3-tier overlay (log_entry > plan_day_adjustments > pristine plan)
- NextMealCard com "Quero comer outra coisa"
- Skipped items strikethrough
- "Esperado plano vs Comido agora" no MealCard da Home

### Coisas necessárias antes de começar a Fase 5

**1. Confirmar comportamento do RPC `activate_meal_plan`.**

Não inspecionei o body ainda. Pra confirmar:

```sql
SELECT pg_get_functiondef('public.activate_meal_plan(uuid)'::regprocedure);
```

Espera-se: marca plan como is_active=true, marca os outros como false
(UNIQUE constraint), e faz cleanup-and-seed do daily_log de hoje:
- DELETE log_meals do daily_log de hoje que vieram do plano antigo
- INSERT log_meals copiando do novo plano
- (Possivelmente preserva log_entries off-plan ou re-cria do zero —
  preciso confirmar)

**2. Decidir formato do picker de food no item-editor.**

Opção A: reusar `AddFoodSheet` da Fase 4 (já tem busca + qty input)
  — mas é "Sheet" que assume contexto de meal+entry. Refactor pra ser
  mais genérico ("FoodPickerSheet" sem meal nem qty).

Opção B: criar `FoodPickerSheet` novo, dedicado pro plan-editor (só
  busca + select, qty é gerenciado no item-editor).

Recomendar B no momento de B4. Discutir antes de codar.

**3. Decidir se save de plano ativo ressincroniza today no B5.**

Recomendo SIM (resolve pendência P14 sem custo). Pequeno trade-off:
operação de save vira "save + reactivate" → 2 chamadas. Adicionar
loading state.

### Decisões pendentes pra Ricardo na Fase 5

- **Onde mora o botão "Criar plano" na lista `/planos`?** FAB
  `bottom-20 right-6` consistente com /foods? Header? Botão inline?
- **Refeições do plano: ordem é por `sort_order` (manual drag) ou por
  `target_time` (auto)?** V1 tinha sort_order manual. Drag-to-reorder
  é polish post-MVP — pra B3, usar ordem de adição.
- **OR alternatives UI:** quando user adiciona segunda option num slot,
  como mostrar "OU" entre elas? Cor de fundo? Tag "OU" entre os cards?
  Decidir no B4 com Ricardo vendo mockup.

### Estimativa

6 blocos. Estimativa 8-12 dias de trabalho dado o padrão de validação
manual do Ricardo. B4 (slots+options+items) é o mais denso — pode virar
dois blocos se ficar grande.

---

## 13. FORMATO DE INÍCIO DO PRÓXIMO CHAT

Ricardo vai abrir chat novo com algo tipo:

> "Lê STATUS.md inteiro, especialmente as regras. Vamos começar a Fase 5."

**Resposta esperada:**

1. Ler STATUS inteiro de fato (não pular pras regras)
2. Aplicar Regra 13: rodar `Get-Content C:\projetos\nutriplan-v2\package.json -Encoding UTF8`
   pra confirmar versões reais antes de propor qualquer coisa
3. Confirmar contexto: "Fase 5 = Planos Alimentares. Estado atual: commit
   `9bf5779`. Banco já tem RPCs `activate_meal_plan` e `get_plan_tree`."
4. **Propor escopo da Fase 5** — relembrar o plano de 6 blocos da §12,
   pedir confirmação ou ajuste
5. **Listar decisões pendentes** (§12 "Decisões pendentes pra Ricardo") e perguntar
6. **Pedir output do `pg_get_functiondef` da `activate_meal_plan`** antes
   de codar B1 — saber o que a RPC faz exatamente
7. Não codar até ter respostas

**Não fazer:**
- Pular pra "vou criar a RPC" sem verificar que ela já existe (Regra 13)
- Assumir UI de OR alternatives sem alinhamento (B4 questão aberta)
- Codar componentes antes de Ricardo aprovar escopo

### Memórias persistentes do projeto

Pra contexto extra além deste STATUS, o memory file
`C:\Users\ricar\.claude\projects\C--projetos-nutriplan-v2\memory\MEMORY.md`
indexa 5 memórias:

1. **feedback_explain_tradeoffs.md** — sempre explicar trade-offs nas decisões
2. **project_native_only.md** — app native iOS+Android via Capacitor
3. **project_rpcs_already_exist.md** — RPCs do blueprint marcadas como
   "por migrar" já existem
4. **project_v1_visual_reference.md** — layout-alvo do diário V1
5. **project_pendings_phase4.md** — pendências descobertas na Fase 4

Esses arquivos têm informação que NÃO está duplicada aqui (especialmente
o `project_v1_visual_reference.md` que tem o layout-alvo detalhado de
MealCard com "Esperado/Comido", bottom nav exato, etc.). Próximo Claude:
ler pelo menos `MEMORY.md` no início pra saber o que existe.

---

## 14. APÊNDICE A — Comandos PowerShell úteis pra inspeção

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

# Confirmar versões reais (Regra 13)
Get-Content C:\projetos\nutriplan-v2\package.json -Encoding UTF8

# Supabase CLI (já instalada via bunx)
bunx supabase --version
bunx supabase db push                    # aplicar migrations à cloud
bunx supabase functions deploy <nome>    # deploy edge function

# SQL no Supabase (no dashboard, SQL Editor)
-- Listar RPCs
SELECT routine_name FROM information_schema.routines
WHERE routine_schema='public' AND routine_type='FUNCTION';

-- Definição de RPC
SELECT pg_get_functiondef('public.<nome>(<argtypes>)'::regprocedure);

-- Schema de tabela
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='<tabela>'
ORDER BY ordinal_position;

-- Listar triggers de uma tabela
SELECT trigger_name, event_manipulation, action_timing, action_statement
FROM information_schema.triggers
WHERE event_object_table = '<tabela>';
```

**Importante sobre o SQL Editor:** se você fizer query com filtro
`WHERE user_id = auth.uid()`, `auth.uid()` retorna NULL no editor (não
há JWT). Resultado: a query parece achar 0 rows. **Use IDs hardcoded
ou role autenticada do dashboard pra contornar.** Aprendido na Fase 4 B1.

---

## 15. APÊNDICE B — Padrão de entrega de bloco (template)

Estrutura ideal de mensagem ao final de um bloco de trabalho:

````
## B<N> — <título curto>

🆕 **Novos (X):** lista
📝 **Editados (Y):** lista
🗑️ **Deletados (Z):** lista (se houver)

### O que está em jogo (Regra 1B)

[explicação do que cada arquivo faz / por que existir, em ~1 parágrafo
por item ou agrupado por tema. Sem essa seção pra blocos triviais.]

[comandos PowerShell pra mover arquivos se necessário]

```powershell
bun run build
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

⚠️ Cola o `git log -3` depois do push (Regra 6).

## Possíveis ruídos antecipados (opcional)

[problemas que podem aparecer, com diagnóstico antecipado]
````

---

## 16. APÊNDICE C — Mapa de arquivos críticos por feature

Pra próximo Claude se orientar rápido sem ler tudo:

### Roteamento global

- `src/App.tsx` — todas as rotas, AuthGuard, OnboardingGuard, Toaster
- `src/features/auth/components/auth-guard.tsx` — renderiza BottomNav após children
- `src/features/onboarding/components/onboarding-guard.tsx` — espelho pro /onboarding
- `src/shared/components/bottom-nav.tsx` — 4 tabs (Hoje/Alimentos/Plano/Perfil)

### Diário (`/`, feature `log`)

- Hook root: `src/features/log/hooks/use-daily-log.ts`
- Mutations (todas no parent, Regra 14): use-add-entry, use-delete-entry,
  use-delete-meal, use-create-meal — em `src/features/log/hooks/`
- Route: `src/features/log/routes/home.tsx` (orchestra tudo)
- Componentes display: DailyProgressCard, MealCard, EntryRow, DateNavigator,
  CalorieRing, MacroBar
- Componentes interativos: NewMealDialog, AddFoodSheet (+ steps), LogRowMenu

### Alimentos (`/foods*`, feature `foods`)

- Hook root: `src/features/foods/hooks/use-food-search.ts` (RPC search_foods)
- Detail/edit: use-food.ts, use-create-food.ts, use-update-food.ts
- Preferências: use-toggle-favorite.ts, use-toggle-hide.ts, use-hidden-foods.ts
- Route principal: `src/features/foods/routes/foods.tsx` (URL search params!)
- Sub-rotas: food-new.tsx, food-detail.tsx, food-edit.tsx
- Componentes: food-search-bar, food-filter-pills, food-results-list, food-row,
  food-row-menu, food-form-*

### Perfil (`/profile*`, feature `profile`)

- Hooks: use-profile.ts (read), use-update-profile.ts (write)
- Routes: profile.tsx (read-only), profile-edit.tsx (edit)
- Onboarding compartilhado: MacroEditor em `features/onboarding/components/`
  (pendência P10 — mover pra `@/components/`)

### Onboarding (`/onboarding`, feature `onboarding`)

- Route: onboarding.tsx
- Steps: step-basic-info, step-body, step-activity, step-goal,
  step-macros-review, step-review (em features/onboarding/components/)
- Hook: use-complete-onboarding.ts
- Schemas: features/onboarding/lib/schemas.ts (zod, compartilhado com profile-edit)

### Auth (`/login`, `/signup`)

- Hooks: useAuth.ts (⚠️ camelCase legado)
- Context: auth-context.ts
- Routes: login.tsx, signup.tsx

### Compartilhados

- `src/components/unit-input.tsx` — Input com unit fixa, edição local
- `src/components/ui/*` — shadcn primitivos
- `src/lib/supabase.ts` — client tipado
- `src/lib/macros.ts` — BMR/TDEE/calculateMacroTargets
- `src/lib/dates.ts` — getTodayBR, addDaysISO, formatDateDDMM,
  formatDateLongBR, formatDateDDMMYYYY
- `src/lib/utils.ts` — cn() do shadcn
- `src/lib/utils-format.ts` — formatadores pt-BR
- `src/types/database.ts` — fonte canônica do schema Supabase

---

**FIM.** Boa sorte ao próximo Claude. Ricardo é direto, valoriza honestidade
sobre o que você não sabe, e não tolera retrabalho por chute. Pesquisa
quando não sabe. Confirma quando não tem certeza. Entrega blocos pequenos.
Sempre explica o que está em jogo (Regra 1B). Sempre verifica versões
e schema antes de propor (Regra 13). Sempre coloca mutations no parent
quando o filho pode desmontar (Regra 14).
