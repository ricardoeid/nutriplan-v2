# NutriPlan V2 — STATUS

Última atualização: 2026-05-07 (fim da Fase 2)

Este arquivo é o resumo do estado atual do projeto. Serve como ponto
de retomada quando você (ou outro turn de IA) precisar entender onde
estamos sem reler todo o histórico de conversas.

---

## ⚠️ Regras de colaboração com IA neste projeto

**1. Entregar arquivos via download, NUNCA em bloco markdown de chat.**

Durante a Fase 1, descobrimos que blocos de código markdown podem
silenciosamente comer caracteres em paste longo — especialmente o `<`
que abre generics em `React.forwardRef`. Isso custou ~10 turnos do
Bloco 3 sendo investigado como se fosse encoding, flags de tsconfig,
ou problema de versão de React. Era simplesmente o paste corrompendo.

Regra: para qualquer arquivo que a IA gerar (componente, página, hook,
config), usar mecanismo de download/anexo do ambiente, **não** copiar
e colar via bloco de código no chat. Vale para arquivos novos E para
edições de arquivos existentes.

**Padrão dos comandos de download:** ao entregar arquivos, sempre
incluir comandos PowerShell pra mover do `~/Downloads` pro path certo:

```powershell
Move-Item -Force $HOME\Downloads\<arquivo> C:\projetos\nutriplan-v2\<destino>
```

Exceção: trechos curtos de código pra explicação conceitual (≤5
linhas, sem generics, sem forwardRef) podem ir em bloco markdown
inline.

**2. Usuário trabalha solo, é leigo em parte do stack, prefere passos
pequenos com validação a cada bloco.**

Quebrar tarefas em blocos curtos. Cada bloco com critério de validação
manual rodável em 1-2 minutos antes de commitar. Não amontoar.

**3. Quando aparecer erro de TS estranho ("Expression expected",
"Operator > cannot be applied", JSX elements sem closing tag em
contexto não-JSX), SUSPEITE PRIMEIRO de caractere faltando no arquivo
gerado**, antes de inventar teorias sobre encoding, tsconfig flags ou
versão de React. Pedir o arquivo e ler com calma. Erros TS em cascata
viram fantasmas absurdos depois do primeiro erro real.

**4. Usuário está no Windows / PowerShell.** Ctrl+C cancela comando
(não copia). Selecionar com mouse + clique direito copia. `cat` mostra
UTF-8 como mojibake (mesmo fenômeno do Excel) — arquivo está íntegro,
é só visualização. Pra outputs longos, prefere redirecionar pra
`resultado.txt` e anexar.

**5. Aritmética: nunca calcular de cabeça.** Quando precisar de número
"esperado" pra validação de bloco (BMR, TDEE, targets de macro,
conversões g↔%), gerar via `bash_tool` com Python ou rodando o próprio
código. Cálculo mental do modelo é não-confiável e gera retrabalho. Se
for matemática de qualquer tipo, vai pelo Python.

---

## Fase 0 — FECHADA ✅

End-to-end vivo: GitHub → Vercel → Vite bundle → React → Supabase
client tipado → query real → 608 alimentos renderizados em produção.

Stack: Vite 8 + React 19 + TypeScript 6 + Tailwind v3 + shadcn/ui classic.
Backend Supabase próprio (região São Paulo) com 14 tabelas e 16 RPCs
migradas do Lovable Cloud. Tabela `foods` com 608 alimentos (591 TACO).

Detalhes completos no histórico — não repetir aqui.

---

## Fase 1 — FECHADA ✅

Auth foundation completo. Stack: TanStack Query, react-router-dom v6,
react-hook-form + zod + @hookform/resolvers, sonner, shadcn classic
adaptado pra React 19 (`React.ComponentRef` em vez de
`React.ElementRef`).

Rotas: `/`, `/login`, `/signup`, `/dashboard` (com AuthGuard).
Provider tree: StrictMode → QueryClient → AuthProvider → App
(BrowserRouter + Routes + Toaster).

Trigger `handle_new_user` validado em produção: signup cria row em
`auth.users` E em `public.profiles` (mesmo UUID).

Detalhes completos no histórico.

---

## Fase 2 — FECHADA ✅

Onboarding multi-step + cálculo de BMR/TDEE/macros + persistência em
`profiles` e `weight_logs` + `/profile` readonly + `/profile/edit`
com MacroEditor dual-mode + AuthGuard v2 com 3 estados (sem user /
sem onboarding / pronto). Validado em produção com 2 contas reais.

### Stack adicionada nesta fase

Nada de pacote novo — toda a fase usou só dependências da Fase 1.
Adicionados 2 primitivos shadcn:

- `@radix-ui/react-radio-group@1.3.8`
- `@radix-ui/react-progress@1.1.8`

### Estrutura de pastas adicionada

```
src/lib/
├── macros.ts                       # BMR/TDEE/macros + ACTIVITY_LEVELS + GOALS
└── utils-format.ts                 # formatadores PT-BR (data, sex, activity, goal)

src/features/onboarding/
├── lib/
│   └── schemas.ts                  # zod por step + agregado
├── hooks/
│   ├── use-onboarding-form.ts      # state machine (currentStep, validateAndGoNext)
│   └── use-complete-onboarding.ts  # mutation submit final
├── components/
│   ├── step-basic-info.tsx         # step 1 — display_name
│   ├── step-body.tsx               # step 2 — sex/birthDate/height/weight
│   ├── step-activity.tsx           # step 3 — activity_level (RadioGroup como cards)
│   ├── step-goal.tsx               # step 4 — goal + preview kcal em tempo real
│   ├── step-macros-review.tsx      # step 5 — 4 cards readonly
│   ├── step-review.tsx             # step 6 — resumo final
│   ├── macro-editor.tsx            # MacroEditor dual-mode (g/%) + UnitInput
│   └── onboarding-guard.tsx        # espelho do AuthGuard pra /onboarding
└── routes/
    └── onboarding.tsx              # casca: Progress + slot do step + nav

src/features/profile/
├── hooks/
│   ├── use-profile.ts              # query do profile do user atual
│   └── use-update-profile.ts       # mutation com recalc opcional
└── routes/
    ├── profile.tsx                 # readonly (dados pessoais + metas + nav)
    └── profile-edit.tsx            # form completo + MacroEditor + checkbox recalc

src/components/ui/
├── radio-group.tsx                 # shadcn classic, ComponentRef pra R19
└── progress.tsx                    # shadcn classic, ComponentRef pra R19

supabase/migrations/
└── 20260506000000_fix_weight_logs_logged_on_default.sql
```

### Rotas finais

- `/` → HomePage (pública)
- `/login` → LoginPage (pública)
- `/signup` → SignupPage (pública)
- `/onboarding` → OnboardingPage (envolvida em `OnboardingGuard`)
- `/dashboard` → DashboardPage (envolvida em `AuthGuard`)
- `/profile` → ProfilePage (envolvida em `AuthGuard`)
- `/profile/edit` → ProfileEditPage (envolvida em `AuthGuard`)

### AuthGuard v2 — 3 estados

- Sem user → `/login`
- User + profile carregando → "Carregando..."
- User + `onboarding_completed=false` → `/onboarding`
- User + `onboarding_completed=true` → renderiza children

`OnboardingGuard` é espelho da mesma lógica mas inverte: se já
completou, manda pra `/dashboard`.

### Cálculo de macros (em `src/lib/macros.ts`)

- BMR Mifflin-St Jeor:
  - Homem: `10·kg + 6.25·cm − 5·idade + 5`
  - Mulher: `10·kg + 6.25·cm − 5·idade − 161`
- TDEE: BMR × multiplicador de atividade (1.2/1.375/1.55/1.725/1.9)
- Targets:
  - kcal = TDEE × multiplicador de goal (cut 0.80, maintain 1.0, bulk 1.10)
  - proteína = peso × 2.0 g/kg
  - gordura = (kcal × 0.25) / 9
  - carbo = (kcal − prot·4 − fat·9) / 4
- Idade calculada de `birth_date` com função própria (`calculateAge`)
  pra centralizar a regra (importa em vários lugares: schemas zod e
  cálculos)

### MacroEditor dual-mode

Source of truth no RHF é **sempre gramas**. O modo controla só display.

**Modo gramas (default na primeira vez):**
- 3 inputs editáveis: prot, carb, fat (em g)
- Calorias é **readonly**, derivado da soma dos macros
- Sem validação de soma — kcal sempre fecha

**Modo percentual:**
- Calorias **editável** (independente)
- 3 inputs editáveis: prot, carb, fat (em %)
- Soma dos % deve fechar 100 (±0.5pp pra arredondamento)
- Quando fora, label "Soma dos macros" fica vermelha
- Submit bloqueado com toast vermelho se soma não fecha (validação
  redundante no `profile-edit.handleSave` que cobre os 2 modos)

Modo persistido em `localStorage('nutriplan:macro-editor-mode')`.

`UnitInput` interno: input com unidade fixa à direita e estado local
de string em edição. Só commita o valor pro RHF no `onBlur` ou Enter.
Isso resolve o "pulo de casa decimal" do v1, onde o `step="0.1"` fazia
o navegador interromper digitação.

### Submit do onboarding (`use-complete-onboarding`)

1. UPDATE em `profiles` (todos os campos + targets calculados +
   `onboarding_completed=true`)
2. INSERT em `weight_logs` (peso atual, `logged_on` usa default do banco)
3. `queryClient.invalidateQueries({ queryKey: ['profile'] })` pra
   destravar AuthGuard que ainda tinha cache stale
4. Toast verde + `navigate('/dashboard', { replace: true })`

INSERT do weight_logs é best-effort: se falhar, onboarding ainda é
considerado completo (warning no console). Pra transação real
precisaria de RPC server-side; fica pra fase futura se virar problema.

### Edição do profile (`use-update-profile`)

- Sempre atualiza dados pessoais (nome, sex, birth_date, height, weight,
  activity, goal)
- Targets dependem do checkbox "Recalcular metas":
  - Ligado → calcula via `calculateMacroTargets` (ignora MacroEditor)
  - Desligado → usa valores manuais do MacroEditor (RHF)
- Weight_log: UPSERT em `(user_id, logged_on)` apenas se peso mudou.
  Não toca em weight_logs se peso é igual ao anterior. Mesmo dia →
  atualiza row existente; novo dia → cria nova.

### Migration 8.5 (timezone fix do weight_logs)

Aplicada via SQL Editor + arquivo versionado em `supabase/migrations/`:

```sql
ALTER TABLE weight_logs
  ALTER COLUMN logged_on
  SET DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date);
```

Fix de off-by-one que afetava users registrando peso após 21h BRT
(servidor UTC interpretava como dia seguinte). Hardcoda fuso BR.
Refator pra coluna `timezone` no profile fica como pendência se app
internacionalizar.

`weight_logs.logged_on` é a única coluna `date` com default temporal
no banco (auditado). Todas as outras 14 colunas com default são
`timestamp with time zone`, que **não** têm o problema (guardam
instante absoluto, cliente formata local).

### Histórico de commits da Fase 2

1. `feat: add BMR/TDEE/macros calculation utilities`
2. `feat: add zod schemas for onboarding steps`
3. `feat: add shadcn radio-group and progress primitives`
4. `feat: onboarding shell with step state machine and placeholders`
5. `feat: implement onboarding steps 1-2 with rhf and zod validation`
6. `feat: implement onboarding steps 3-4 with activity/goal selection and live calorie preview`
7. `fix: add pt-br error messages for sex/activity/goal validators`
8. `feat: implement onboarding submit (profile update + initial weight log)`
9. `feat: AuthGuard v2 with onboarding completion check`
10. `fix(db): weight_logs.logged_on default uses brasilia timezone`
11. `feat: profile readonly page and dashboard nav cleanup`
12. `feat: profile edit form with optional target recalculation`
13. `feat: macro editor with grams/percent dual mode and sum validation`

### Contas de teste

- `teste1@nutriplan.dev` (UID `2aaccee9-1909-460f-bdbd-9b3f4353b396`)
  — onboarding completo (Ricardo, M, 1996-05-06, 175cm)
- `teste2@nutriplan.dev` — onboarding completo durante teste do Bloco 8

Os 4 cenários do AuthGuard v2 foram validados com essas duas contas.

---

## Decisões importantes tomadas (Fase 2)

### Único `useForm` no parent, steps recebem `form` por prop

Em vez de cada step ter seu próprio `useForm` interno e callback
`onSubmit`, o `useOnboardingForm` mantém um único form com o schema
agregado. Cada step do onboarding (e o profile-edit também) recebe
`form: UseFormReturn<OnboardingFullData>` como prop. Vantagens:

- Estado dos forms vive em um lugar só, simétrico com `currentStep`
- Navegação entre steps preserva valores sem `useEffect` de hidratação
- Submit final tem todos os campos juntos sem mexer
- Steps são reaproveitados no profile-edit sem mudar nada

Validação por step: o schema agregado é o resolver, mas
`form.trigger(['campos','do','step'])` valida só o subset do step ativo.

### MacroEditor dual-mode com source of truth em gramas

Banco guarda gramas. UI tem 2 modos. Source of truth no RHF é sempre
gramas. Modo controla só display/input. Conversão acontece na borda
(no display e no commit do input).

Em modo gramas, kcal não é editável — é a soma derivada. Em modo
percentual, kcal é editável e independente; os % devem fechar 100.
Foram 2 cabeças se misturando no v1 que motivou refactor 11.1.

### `UnitInput` com string em edição local

Inputs numéricos com `step="0.1"` causam "pulo de casa decimal" — o
navegador interrompe digitação. Solução: input mantém estado local
`editing: string | null` enquanto user digita, só converte/commita pro
RHF no `onBlur` ou Enter. Padrão controlled input com display string.

### Migration 8.5 hardcoda 'America/Sao_Paulo' (não coluna no profile)

Decisão: app é mercado BR. Hardcoded resolve 100% dos casos atuais
sem complexidade de trigger ou coluna `timezone` no profile. Quando
internacionalizar, refator é trivial (1 ALTER + 1 trigger).

### Targets de profile como `optional` no schema agregado

`calorieTarget`, `proteinTarget`, `carbTarget`, `fatTarget` foram
adicionados ao `onboardingFullSchema` como optional. Onboarding não
envia (são calculados no submit); profile-edit pode enviar (vindos do
MacroEditor). Schema único cobre os 2 casos.

### `useFormContext` evitado intencionalmente

Padrão alternativo seria `<Form>` com context provider e cada step
chamando `useFormContext()`. Optei por `form` como prop pra ficar
explícito. Boilerplate trivial (1 prop), legibilidade ganha.

---

## Pendências conhecidas

### Item A — Despublicar Lovable Cloud V1 (futuro)

Quando V2 estiver com paridade funcional + dados reais migrados +
testado em produção, despublicar/deletar projeto Lovable original.

### Item B — Curações: 11 vs 13

Blueprint mencionava 13. No banco V2 vieram 11. Diferença pequena.
Ajustar via UPDATE pontual se aparecer alimento óbvio com
`default_serving_g = 100` que deveria ter unidade natural.

### Item C — RLS user-scoped — RESOLVIDO ✅ (Fase 1)

### Item D — `supabase/.temp/` regenera

`.gitignore` segura. Cache do Supabase CLI sendo regenerado.

### Item E — Bundle size aviso ~660kb minified

Foi de 600kb (Fase 1) pra 661kb com a Fase 2. 188kb gzip. Code-splitting
via dynamic import vai ser feito na Fase 6 (PWA). Por enquanto, ignorar.

### Item F — `forwardRef` deprecation em React 19

`radio-group.tsx` e `progress.tsx` (Fase 2) também usam o padrão antigo.
Quando bater warning real ou no próximo refactor grande, migrar tudo de
uma vez.

### Item G — TS 6 + LSP do Cursor: aviso de `baseUrl` deprecated

Não mexer — sugestão do aviso quebra o alias `@/`. Build CLI ignora.

### Item H — Warnings do React Router v6 sobre v7

`v7_startTransition`, `v7_relativeSplatPath` no console em dev. Avisos
de "future flag", silenciáveis com flags de opt-in. Inofensivos.

### Item I — Forgot/reset password

Não implementado. Sub-fase 1.1 do blueprint. Próxima conta esquecida =
primeira pressão pra fazer.

### Item J — Defesa em camadas pro timezone (NOVO)

Migration 8.5 corrigiu o servidor (default da coluna usa fuso BR). Mas
se o app for usado fora do BR (user viajando, fora do horário comercial
de SP), os logs ainda podem ficar 1h+ off do "dia" do user. Plano B
seria o cliente mandar `logged_on` explícito calculado em JS local.
Resolve completamente, mas adiciona complexidade. Por enquanto,
hardcode BR resolve o caso comum.

### Item K — Transação real no submit do onboarding (NOVO)

`use-complete-onboarding` faz UPDATE profiles + INSERT weight_logs como
2 chamadas separadas. Se INSERT falhar mas UPDATE já passou, fica
inconsistente (best effort: warning no console, onboarding considera-se
completo). Pra atomicidade real, criar RPC server-side. Não urgente.

### Item L — Steps do onboarding em pasta de feature de onboarding (NOVO)

`MacroEditor` é usado **só** no `/profile/edit`, mas mora em
`src/features/onboarding/components/`. Foi conveniência durante
desenvolvimento (perto dos outros steps). Quando virar caso de uso
maior, mover pra `src/features/profile/components/` ou
`src/components/macro-editor.tsx` (se virar genérico).

---

## Lições aprendidas (pra futuras fases)

(da Fase 0)

1. Build da Vercel é mais estrito que `bun dev` local. TS versions diferem.
2. Excel/Windows mostra UTF-8 sem BOM como Latin-1 (mojibake). Visualização.
3. CSV do Supabase usa `;` como separador.
4. shadcn CLI atual está em transição. Copiar manualmente é mais seguro.

(da Fase 1)

5. Bloco markdown de chat pode comer caracteres em paste longo. Pra
   arquivos não-triviais, entregar via download direto.
6. Quando erro do tsc parece absurdo, suspeitar primeiro de caractere
   faltando muitas linhas acima.
7. TS 6 + Vite 8 + R19 + flags estritas é stack bleeding-edge.
8. `StrictMode` em dev faz componentes re-renderizarem 2x.
9. PowerShell mostra arquivo UTF-8 com mojibake no `cat`.

(da Fase 2)

10. **Aritmética mental do modelo é não-confiável.** Pra qualquer
    "esperado" numérico (BMR, TDEE, conversões g↔%, soma de macros),
    gerar via Python no `bash_tool` antes de pedir validação. Calcular
    de cabeça custou retrabalho real (Bloco 1, Bloco 6).

11. **Inputs numéricos com unidade precisam de string em edição local.**
    `<input type="number" step="0.1" value={x.toFixed(1)}>` causa
    pulo de casa decimal — navegador interrompe digitação. Padrão:
    estado local `editing: string | null`, commita no `onBlur`/Enter.
    Vide `UnitInput` em `macro-editor.tsx`.

12. **UI dual-mode precisa de modelo conceitual explícito antes de
    codar.** O v1 do MacroEditor misturou "kcal derivado" e "kcal
    independente com warnings de soma" no mesmo modelo, causando UX
    incoerente. Refactor 11.1 separou: modo g (kcal=soma), modo %
    (kcal independente, % fecham 100). Antes de UI complexa: escrever
    o modelo, listar invariantes, depois codar.

13. **Tipos do Supabase são estritos por design — usar.** Quando o
    `.update()` reclama de `Record<string, unknown>`, a solução
    correta é `Database['public']['Tables']['profiles']['Update']`,
    não cast. Tipo capturou erro real (faltava enum no payload).

14. **Modelo (Claude) não tem relógio em tempo real.** Recebe data
    atual no system prompt e não atualiza durante a conversa. Quando
    o user reporta data de algo (`logged_on=2026-05-07`), comparar
    com a data do system prompt antes de investigar bug. Bloco 10 teve
    investigação desnecessária de timezone porque eu não conferi a
    data atual antes.

---

## Próximas fases (do blueprint)

### Fase 3 — Banco de alimentos + busca

- Página de busca usando RPC `search_foods`
- Cache de OFF (Open Food Facts) sob demanda
- UI pra criar custom foods
- HiddenFoodsSection no profile (Item L do v1)

### Fase 4 — Daily logs (registro diário)

- UI de "comi tal alimento, tal porção"
- Tabela diária com totais
- Histórico

### Fase 5 — Meal plans

- Templates de plano alimentar
- Slots → opções → entries
- Activate plan

### Fase 6 — PWA

- Service worker
- Offline básico
- Code-splitting (resolve Item E)

### Fase 7+ — Polish, observability, refactors

- Migrar `forwardRef` (Item F)
- Forgot password (Item I)
- Despublicar Lovable V1 (Item A)
- Etc
