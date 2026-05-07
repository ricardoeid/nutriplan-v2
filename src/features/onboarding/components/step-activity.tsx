import { type UseFormReturn } from 'react-hook-form'

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

import { ACTIVITY_LEVELS } from '@/lib/macros'
import { type OnboardingFullData } from '../lib/schemas'

interface Props {
  form: UseFormReturn<OnboardingFullData>
}

export function StepActivity({ form }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Quão ativo você é?</h2>
        <p className="text-sm text-muted-foreground">
          Considere uma semana típica.
        </p>
      </div>

      <FormField
        control={form.control}
        name="activityLevel"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                className="gap-2"
              >
                {ACTIVITY_LEVELS.map((level) => (
                  <Label
                    key={level.value}
                    htmlFor={`activity-${level.value}`}
                    className="flex items-start gap-3 rounded-md border border-input p-3 cursor-pointer hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-accent/50"
                  >
                    <RadioGroupItem
                      value={level.value}
                      id={`activity-${level.value}`}
                      className="mt-1"
                    />
                    <div className="space-y-0.5">
                      <div className="font-medium leading-none">
                        {level.label}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {level.description}
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
    </div>
  )
}
