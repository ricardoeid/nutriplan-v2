import { type UseFormReturn } from 'react-hook-form'

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

import {
  GOALS,
  calculateAge,
  calculateBMR,
  calculateMacroTargets,
  calculateTDEE,
} from '@/lib/macros'
import { type OnboardingFullData } from '../lib/schemas'

interface Props {
  form: UseFormReturn<OnboardingFullData>
}

export function StepGoal({ form }: Props) {
  // Watch dos 5 campos necessários pro cálculo. Em uso normal, todos
  // já passaram validação dos steps 2 e 3 quando chegamos aqui — mas
  // checagem defensiva pra não quebrar render se algum vier vazio.
  const sex = form.watch('sex')
  const birthDate = form.watch('birthDate')
  const heightCm = form.watch('heightCm')
  const weightKg = form.watch('weightKg')
  const activityLevel = form.watch('activityLevel')
  const goal = form.watch('goal')

  const canCalculate =
    !!sex &&
    !!birthDate &&
    typeof heightCm === 'number' &&
    typeof weightKg === 'number' &&
    !!activityLevel &&
    !!goal

  let calorieTarget: number | null = null
  if (canCalculate) {
    const age = calculateAge(new Date(birthDate))
    const bmr = calculateBMR({
      sex,
      ageYears: age,
      heightCm,
      weightKg,
    })
    const tdee = calculateTDEE(bmr, activityLevel)
    const targets = calculateMacroTargets({ tdee, goal, weightKg })
    calorieTarget = targets.calorieTarget
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Qual seu objetivo?</h2>
        <p className="text-sm text-muted-foreground">
          Isso define o ajuste calórico sobre seu gasto.
        </p>
      </div>

      <FormField
        control={form.control}
        name="goal"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                className="gap-2"
              >
                {GOALS.map((g) => (
                  <Label
                    key={g.value}
                    htmlFor={`goal-${g.value}`}
                    className="flex items-start gap-3 rounded-md border border-input p-3 cursor-pointer hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-accent/50"
                  >
                    <RadioGroupItem
                      value={g.value}
                      id={`goal-${g.value}`}
                      className="mt-1"
                    />
                    <div className="space-y-0.5">
                      <div className="font-medium leading-none">{g.label}</div>
                      <div className="text-sm text-muted-foreground">
                        {g.description}
                      </div>
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {calorieTarget !== null && (
        <div className="rounded-md bg-muted p-3 text-center">
          <div className="text-xs text-muted-foreground">Sua meta diária</div>
          <div className="text-2xl font-semibold">
            {calorieTarget} kcal
          </div>
        </div>
      )}
    </div>
  )
}
