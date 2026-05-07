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
import { StepBasicInfo } from '../components/step-basic-info'
import { StepBody } from '../components/step-body'
import { StepActivity } from '../components/step-activity'
import { StepGoal } from '../components/step-goal'
import { StepMacrosReview } from '../components/step-macros-review'
import { StepReview } from '../components/step-review'

function OnboardingPage() {
  const {
    form,
    currentStep,
    validateAndGoNext,
    goBack,
    isFirstStep,
    isLastStep,
    progressPercent,
  } = useOnboardingForm()

  // Steps 1 e 2 já recebem `form` (Bloco 5). Steps 3-6 ainda são
  // placeholders e serão atualizados nos blocos 6 e 7.
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <StepBasicInfo form={form} />
      case 2:
        return <StepBody form={form} />
      case 3:
        return <StepActivity />
      case 4:
        return <StepGoal />
      case 5:
        return <StepMacrosReview />
      case 6:
        return <StepReview />
      default:
        return null
    }
  }

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
          {/* form HTML envolve o conteúdo só pra agrupar acessivelmente.
              Submit "real" é via botão Próximo chamando validateAndGoNext;
              não usamos onSubmit do <form> aqui. */}
          <form onSubmit={(e) => e.preventDefault()}>
            <CardContent className="min-h-32">{renderStep()}</CardContent>
            <CardFooter className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={goBack}
                disabled={isFirstStep}
              >
                Voltar
              </Button>
              <Button type="button" onClick={validateAndGoNext}>
                {isLastStep ? 'Concluir' : 'Próximo'}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  )
}

export default OnboardingPage
