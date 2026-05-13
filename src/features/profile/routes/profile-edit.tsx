import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { Label } from '@/components/ui/label'

import { useProfile } from '@/features/profile/hooks/use-profile'
import { useUpdateProfile } from '@/features/profile/hooks/use-update-profile'
import {
  onboardingFullSchema,
  type OnboardingFullData,
} from '@/features/onboarding/lib/schemas'
import { StepBasicInfo } from '@/features/onboarding/components/step-basic-info'
import { StepBody } from '@/features/onboarding/components/step-body'
import { StepActivity } from '@/features/onboarding/components/step-activity'
import { StepGoal } from '@/features/onboarding/components/step-goal'
import { MacroEditor } from '@/features/onboarding/components/macro-editor'
import type {
  ActivityLevel,
  Goal,
  Sex,
} from '@/lib/macros'

const MACRO_SUM_TOLERANCE_PCT = 0.5 // bate com SUM_TOLERANCE_PP do MacroEditor

function ProfileEditPage() {
  const navigate = useNavigate()
  const { profile, loading } = useProfile()

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  return <ProfileEditForm profile={profile} navigate={navigate} />
}

interface FormProps {
  profile: NonNullable<ReturnType<typeof useProfile>['profile']>
  navigate: ReturnType<typeof useNavigate>
}

function ProfileEditForm({ profile, navigate }: FormProps) {
  const [recalculateTargets, setRecalculateTargets] = useState(true)
  const updateProfile = useUpdateProfile()

  const form = useForm<OnboardingFullData>({
    resolver: zodResolver(onboardingFullSchema),
    mode: 'onSubmit',
    defaultValues: {
      displayName: profile.display_name ?? '',
      sex: (profile.sex as Sex) ?? undefined,
      birthDate: profile.birth_date ?? '',
      heightCm: profile.height_cm ?? undefined,
      weightKg: profile.weight_kg ?? undefined,
      activityLevel: (profile.activity_level as ActivityLevel) ?? undefined,
      goal: (profile.goal as Goal) ?? undefined,
      // Targets atuais — viram source of truth do MacroEditor
      calorieTarget: profile.calorie_target ?? undefined,
      proteinTarget: profile.protein_target ?? undefined,
      carbTarget: profile.carb_target ?? undefined,
      fatTarget: profile.fat_target ?? undefined,
    },
  })

  const handleSave = async () => {
    const ok = await form.trigger()
    if (!ok) {
      toast.error('Há campos com erro. Revise e tente de novo.')
      return
    }

    // Validação adicional: se está editando manual (recalc desligado),
    // a soma dos macros (em kcal) deve bater com calorie_target dentro
    // da tolerância. Cobre tanto modo gramas (kcal=soma, sempre bate)
    // quanto modo percentual (kcal independente, % devem fechar 100).
    if (!recalculateTargets) {
      const v = form.getValues()
      const kcal = v.calorieTarget ?? 0
      const sum =
        (v.proteinTarget ?? 0) * 4 +
        (v.carbTarget ?? 0) * 4 +
        (v.fatTarget ?? 0) * 9
      const diffPct = kcal > 0 ? Math.abs(sum - kcal) / kcal * 100 : 100
      if (diffPct > MACRO_SUM_TOLERANCE_PCT) {
        toast.error('Os macros não fecham com a meta calórica. Ajuste antes de salvar.')
        return
      }
    }

    updateProfile.mutate(
      {
        data: form.getValues(),
        recalculateTargets,
        previousWeightKg: profile.weight_kg ?? null,
      },
      {
        onSuccess: () => {
          toast.success('Perfil atualizado')
          navigate('/profile')
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
        },
      },
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 pb-24">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <h1 className="text-2xl font-semibold">Editar perfil</h1>
        </CardHeader>

        <Form {...form}>
          <form onSubmit={(e) => e.preventDefault()}>
            <CardContent className="space-y-6">
              <StepBasicInfo form={form} />
              <StepBody form={form} />
              <StepActivity form={form} />
              <StepGoal form={form} />

              <div className="flex items-start gap-2 rounded-md border border-input p-3">
                <input
                  type="checkbox"
                  id="recalc"
                  checked={recalculateTargets}
                  onChange={(e) => setRecalculateTargets(e.target.checked)}
                  className="mt-1"
                />
                <div>
                  <Label htmlFor="recalc" className="font-medium cursor-pointer">
                    Recalcular metas automaticamente
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Quando ligado, suas metas são calculadas a partir dos dados acima.
                    Desligue pra editar manualmente abaixo.
                  </p>
                </div>
              </div>

              <MacroEditor form={form} disabled={recalculateTargets} />
            </CardContent>

            <CardFooter className="flex justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                asChild
                disabled={updateProfile.isPending}
              >
                <Link to="/profile">Cancelar</Link>
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={updateProfile.isPending}
              >
                {updateProfile.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  )
}

export default ProfileEditPage
