import { useEffect, useState } from 'react'
import { type UseFormReturn } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type OnboardingFullData } from '../lib/schemas'

const STORAGE_KEY = 'nutriplan:macro-editor-mode'
type Mode = 'g' | 'percent'
const KCAL_PER_G = { protein: 4, carb: 4, fat: 9 } as const
// Tolerância da soma dos % em modo percentual: 99.5 a 100.5 OK.
// Cobre arredondamento pra inteiro nos g sem deixar passar erro real.
const SUM_TOLERANCE_PP = 0.5

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
  useEffect(() => {
    if (mode === 'g' && !disabled) {
      const current = form.getValues('calorieTarget')
      if (current !== sumKcal) {
        form.setValue('calorieTarget', sumKcal, { shouldDirty: true })
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
                  onCommit={(v) => field.onChange(v ?? undefined)}
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

        // Valor que o input mostra quando NÃO está em edição
        const persistedDisplay =
          grams === null
            ? ''
            : mode === 'g'
              ? String(Math.round(grams))
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
                  // Converter de volta pra gramas se em modo %
                  if (mode === 'percent') {
                    if (kcalForPct <= 0) return
                    const g = (num / 100 * kcalForPct) / kcalPerG
                    field.onChange(Math.round(g))
                  } else {
                    field.onChange(Math.round(num))
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

// === UnitInput ===
// Wrapper de Input que: (a) mostra unidade fixa à direita; (b) usa
// estado local de string em edição pra não interromper a digitação
// (corrige o "pulo de casa decimal" do v1); (c) só commita o valor
// pro pai no onBlur ou Enter.
interface UnitInputProps {
  type: 'integer' | 'decimal'
  unit: string
  value: string | number | null
  onCommit: (value: string | null) => void
  disabled?: boolean
}

function UnitInput({ type, unit, value, onCommit, disabled }: UnitInputProps) {
  const [editing, setEditing] = useState<string | null>(null)

  const display =
    editing !== null
      ? editing
      : value === null || value === undefined
        ? ''
        : String(value)

  const commit = () => {
    if (editing === null) return
    onCommit(editing.trim() === '' ? null : editing.trim())
    setEditing(null)
  }

  return (
    <div className="relative">
      <Input
        type="text"
        inputMode={type === 'integer' ? 'numeric' : 'decimal'}
        disabled={disabled}
        value={display}
        onChange={(e) => setEditing(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        className="pr-10"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
        {unit}
      </span>
    </div>
  )
}
