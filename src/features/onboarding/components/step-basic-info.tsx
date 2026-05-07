import { type UseFormReturn } from 'react-hook-form'

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

import { type OnboardingFullData } from '../lib/schemas'

interface Props {
  form: UseFormReturn<OnboardingFullData>
}

export function StepBasicInfo({ form }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Como você se chama?</h2>
        <p className="text-sm text-muted-foreground">
          Esse nome vai aparecer no seu perfil.
        </p>
      </div>

      <FormField
        control={form.control}
        name="displayName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nome</FormLabel>
            <FormControl>
              <Input placeholder="Ex: Ricardo" autoFocus {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
