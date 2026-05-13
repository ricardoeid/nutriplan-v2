import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { Progress } from '@/components/ui/progress'

import { useOnboardingForm } from '../hooks/use-onboarding-form'
import { useCompleteOnboarding } from '../hooks/use-complete-onboarding'
import { StepBasicInfo } from '../components/step-basic-info'
import { StepBody } from '../components/step-body'
import { StepActivity } from '../components/step-activity'
import { StepGoal } from '../components/step-goal'
import { StepMacrosReview } from '../components/step-macros-review'
import { StepReview } from '../components/step-review'

function OnboardingPage() {
  const navigate = useNavigate()
  const completeOnboarding = useCompleteOnboarding()

  const {
    form,
    currentStep,
    validateAndGoNext,
    goBack,
    isFirstStep,
    isLastStep,
    progressPercent,
  } = useOnboardingForm()

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <StepBasicInfo form={form} />
      case 2:
        return <StepBody form={form} />
      case 3:
        return <StepActivity form={form} />
      case 4:
        return <StepGoal form={form} />
      case 5:
        return <StepMacrosReview form={form} />
      case 6:
        return <StepReview form={form} />
      default:
        return null
    }
  }

  // Click do botão "Concluir" no step 6: valida tudo via RHF + zod
  // (failsafe — em uso normal já passou step a step), depois dispara
  // a mutation. Toast + navigate em success; toast em erro mantém
  // o user no step 6 pra poder tentar de novo.
  const handleConcluir = async () => {
    const ok = await form.trigger()
    if (!ok) {
      toast.error('Há campos pendentes. Volte e revise.')
      return
    }

    completeOnboarding.mutate(form.getValues(), {
      onSuccess: () => {
        toast.success('Tudo pronto!')
        navigate('/', { replace: true })
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
      },
    })
  }

  const handlePrimaryClick = isLastStep ? handleConcluir : validateAndGoNext

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-3">
          <Progress value={progressPercent} />
          <p className="text-xs text-muted-foreground text-center">
            Passo {currentStep} de 6
          </p>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={(e) => e.preventDefault()}>
            <CardContent className="min-h-32">{renderStep()}</CardContent>
            <CardFooter className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={goBack}
                disabled={isFirstStep || completeOnboarding.isPending}
              >
                Voltar
              </Button>
              <Button
                type="button"
                onClick={handlePrimaryClick}
                disabled={completeOnboarding.isPending}
              >
                {isLastStep
                  ? completeOnboarding.isPending
                    ? 'Salvando...'
                    : 'Concluir'
                  : 'Próximo'}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  )
}

export default OnboardingPage
