import { useEffect, useState } from 'react'
import { type UseFormReturn } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { Label } from '@/components/ui/label'
import { UnitInput } from '@/components/unit-input'
import { type OnboardingFullData } from '../lib/schemas'

const STORAGE_KEY = 'nutriplan:macro-editor-mode'
type Mode = 'g' | 'percent'
const KCAL_PER_G = { protein: 4, carb: 4, fat: 9 } as const
// Tolerância da soma dos % em modo percentual: 99.5 a 100.5 OK.
// Cobre arredondamento pra inteiro nos g sem deixar passar erro real.
const SUM_TOLERANCE_PP = 0.5

// Storage de gramas em múltiplos de 0.25 (sugestão do Ricardo).
// Por quê: round-trip g↔% precisa preservar o valor digitado em %.
// Como kcal/g é 4 pra prot/carbo e 9 pra gordura, valores em % comuns
// (35%, 50%, etc.) geram gramas que são naturalmente múltiplos de 0.25
// pra os macros ×4. Pra ×9 (gordura), a aproximação 0.25 mantém o
// drift abaixo de 0.05pp — invisível com toFixed(1) no display.
//
// Inteiro só não basta: proteína 35% de 2500 = 218.75g; ao arredondar
// pra 219 e voltar, volta 35.04% (limpo). MAS carbo 50% de 2500 = 312.5g;
// ao arredondar pra 313, volta 50.08% → "50.1%" — drift visível.
function roundToQuarter(n: number): number {
  return Math.round(n * 4) / 4
}

// Formata gramas pra display: mostra inteiro quando inteiro, senão até
// 2 decimais sem zeros à direita ("218.75", "312.5", "42").
function formatGramsForDisplay(g: number): string {
  const rounded = Math.round(g * 100) / 100
  if (Number.isInteger(rounded)) return String(rounded)
  // Remove zeros à direita ("12.50" → "12.5", "12.00" → "12")
  return String(rounded).replace(/\.?0+$/, '')
}

interface Props {
  form: UseFormReturn<OnboardingFullData>
  disabled?: boolean
}

function readPersistedMode(): Mode {
  if (typeof window === 'undefined') return 'g'
  return window.localStorage.getItem(STORAGE_KEY) === 'percent' ? 'percent' : 'g'
}

export function MacroEditor({ form, disabled = false }: Props) {
  const [mode, setMode] = useState<Mode>(() => readPersistedMode())

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  // Source of truth no RHF é sempre gramas. Modo % converte na borda.
  const protein = form.watch('proteinTarget') ?? 0
  const carb = form.watch('carbTarget') ?? 0
  const fat = form.watch('fatTarget') ?? 0
  const kcalFromForm = form.watch('calorieTarget') ?? 0

  // Em modo gramas, kcal exibido = soma derivada.
  // Em modo %, kcal exibido = valor que o user controla (vem do RHF).
  const sumKcal = protein * KCAL_PER_G.protein + carb * KCAL_PER_G.carb + fat * KCAL_PER_G.fat
  const displayedKcal = mode === 'g' ? sumKcal : kcalFromForm

  // Em modo gramas, mantém o RHF sincronizado: calorie_target = soma dos macros.
  // Sem isso, o save mandaria kcal antigo enquanto user pensou que mudou.
  // Math.round porque calorias é integer (consistente com onCommit do
  // input de calorias em modo %).
  useEffect(() => {
    if (mode === 'g' && !disabled) {
      const target = Math.round(sumKcal)
      const current = form.getValues('calorieTarget')
      if (current !== target) {
        form.setValue('calorieTarget', target, { shouldDirty: true })
      }
    }
  }, [mode, disabled, sumKcal, form])

  // Validação de soma em modo %
  const pctProtein = displayedKcal > 0 ? (protein * 4 / displayedKcal) * 100 : 0
  const pctCarb = displayedKcal > 0 ? (carb * 4 / displayedKcal) * 100 : 0
  const pctFat = displayedKcal > 0 ? (fat * 9 / displayedKcal) * 100 : 0
  const sumPct = pctProtein + pctCarb + pctFat
  const sumOk = Math.abs(sumPct - 100) <= SUM_TOLERANCE_PP

  return (
    <div className="space-y-3 rounded-md border border-input p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Editar metas</h3>
        <div className="flex gap-1 rounded-md border border-input p-0.5">
          <Button
            type="button"
            variant={mode === 'g' ? 'default' : 'ghost'}
            size="sm"
            disabled={disabled}
            onClick={() => setMode('g')}
            className="h-7 px-2 text-xs"
          >
            Gramas
          </Button>
          <Button
            type="button"
            variant={mode === 'percent' ? 'default' : 'ghost'}
            size="sm"
            disabled={disabled}
            onClick={() => setMode('percent')}
            className="h-7 px-2 text-xs"
          >
            Percentual
          </Button>
        </div>
      </div>

      {disabled && (
        <p className="text-xs text-muted-foreground">
          Recalcular metas está ligado — desligue acima pra editar manualmente.
        </p>
      )}

      {/* === Calorias === */}
      {/* modo g: readonly, derivado.    modo %: editável. */}
      {mode === 'g' ? (
        <div className="space-y-1.5">
          <Label className="text-xs">Calorias</Label>
          <div className="flex items-center justify-between rounded-md border border-input bg-muted/30 px-3 py-2 text-sm">
            <span className="font-medium">{Math.round(sumKcal)}</span>
            <span className="text-xs text-muted-foreground">kcal (calculado)</span>
          </div>
        </div>
      ) : (
        <FormField
          control={form.control}
          name="calorieTarget"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Calorias</FormLabel>
              <FormControl>
                <UnitInput
                  type="integer"
                  unit="kcal"
                  value={field.value ?? null}
                  onCommit={(v) => {
                    if (v == null || v === '') {
                      field.onChange(undefined)
                      return
                    }
                    const num = Number(v)
                    if (Number.isNaN(num)) return
                    const newKcal = Math.round(num)

                    // Em modo %, o modelo mental do user é "%s são
                    // fixos, mudar kcal reescala os gramas". Sem isso,
                    // gramas ficam congelados e os %s saem do trilho
                    // (ex: 3600→2500 kcal mantendo 315g de proteína
                    // dispara display de 50.4% — confuso). Logo, ao
                    // commitar nova calorias, escalo todos os macros
                    // pelo ratio (novo/antigo).
                    const oldKcal = field.value
                    if (
                      typeof oldKcal === 'number' &&
                      oldKcal > 0 &&
                      newKcal > 0
                    ) {
                      const ratio = newKcal / oldKcal
                      const oldP = form.getValues('proteinTarget') ?? 0
                      const oldC = form.getValues('carbTarget') ?? 0
                      const oldF = form.getValues('fatTarget') ?? 0
                      form.setValue(
                        'proteinTarget',
                        roundToQuarter(oldP * ratio),
                        { shouldDirty: true },
                      )
                      form.setValue(
                        'carbTarget',
                        roundToQuarter(oldC * ratio),
                        { shouldDirty: true },
                      )
                      form.setValue(
                        'fatTarget',
                        roundToQuarter(oldF * ratio),
                        { shouldDirty: true },
                      )
                    }

                    // Parse pra number — zod valida z.number(), passar
                    // string aqui faz "Expected number, received string".
                    field.onChange(newKcal)
                  }}
                  disabled={disabled}
                />
              </FormControl>
            </FormItem>
          )}
        />
      )}

      {/* === Proteína / Carbo / Gordura === */}
      <div className="grid grid-cols-3 gap-2">
        <MacroFieldGrams
          form={form}
          name="proteinTarget"
          label="Proteína"
          mode={mode}
          kcalForPct={displayedKcal}
          kcalPerG={KCAL_PER_G.protein}
          disabled={disabled}
        />
        <MacroFieldGrams
          form={form}
          name="carbTarget"
          label="Carboidrato"
          mode={mode}
          kcalForPct={displayedKcal}
          kcalPerG={KCAL_PER_G.carb}
          disabled={disabled}
        />
        <MacroFieldGrams
          form={form}
          name="fatTarget"
          label="Gordura"
          mode={mode}
          kcalForPct={displayedKcal}
          kcalPerG={KCAL_PER_G.fat}
          disabled={disabled}
        />
      </div>

      {/* Soma dos % — só relevante em modo % */}
      {mode === 'percent' && !disabled && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Soma dos macros</span>
          <span className={sumOk ? 'text-muted-foreground' : 'text-red-600 font-medium'}>
            {sumPct.toFixed(1)}% {sumOk ? '✓' : '— deve fechar 100%'}
          </span>
        </div>
      )}
    </div>
  )
}

// === MacroFieldGrams ===
// Renderiza um input de macro (prot/carb/fat). Source of truth no RHF
// é sempre gramas. Em modo %, o input mostra/aceita % e converte
// internamente.
interface MacroFieldProps {
  form: UseFormReturn<OnboardingFullData>
  name: 'proteinTarget' | 'carbTarget' | 'fatTarget'
  label: string
  mode: Mode
  kcalForPct: number
  kcalPerG: number
  disabled: boolean
}

function MacroFieldGrams({
  form,
  name,
  label,
  mode,
  kcalForPct,
  kcalPerG,
  disabled,
}: MacroFieldProps) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => {
        const grams = field.value ?? null

        // Valor que o input mostra quando NÃO está em edição.
        // Modo g: até 2 decimais, sem zeros à direita (218.75, 312.5, 42).
        // Modo %: 1 decimal (35.0, 50.0, 15.0).
        const persistedDisplay =
          grams === null
            ? ''
            : mode === 'g'
              ? formatGramsForDisplay(grams)
              : kcalForPct > 0
                ? ((grams * kcalPerG) / kcalForPct * 100).toFixed(1)
                : ''

        return (
          <FormItem>
            <FormLabel className="text-xs">{label}</FormLabel>
            <FormControl>
              <UnitInput
                type={mode === 'g' ? 'integer' : 'decimal'}
                unit={mode === 'g' ? 'g' : '%'}
                value={persistedDisplay}
                onCommit={(strValue) => {
                  if (strValue === '' || strValue === null) {
                    field.onChange(undefined)
                    return
                  }
                  const num = Number(strValue)
                  if (Number.isNaN(num)) return
                  // Storage em múltiplo de 0.25. Round-trip g↔% sem
                  // drift visível pra macros ×4 (proteína, carbo);
                  // pra ×9 (gordura) drift máximo de 0.05pp, invisível
                  // com toFixed(1).
                  if (mode === 'percent') {
                    if (kcalForPct <= 0) return
                    const g = (num / 100 * kcalForPct) / kcalPerG
                    field.onChange(roundToQuarter(g))
                  } else {
                    field.onChange(roundToQuarter(num))
                  }
                }}
                disabled={disabled}
              />
            </FormControl>
          </FormItem>
        )
      }}
    />
  )
}

