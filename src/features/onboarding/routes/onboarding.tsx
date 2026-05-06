import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card'
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
    currentStep,
    goNext,
    goBack,
    isFirstStep,
    isLastStep,
    progressPercent,
  } = useOnboardingForm()

  // switch explícito (em vez de array indexado) porque cada step vai
  // receber props distintas nos blocos 5/6/7. Verbosidade compensa.
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <StepBasicInfo />
      case 2:
        return <StepBody />
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
        <CardContent className="min-h-32">{renderStep()}</CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={goBack} disabled={isFirstStep}>
            Voltar
          </Button>
          <Button onClick={goNext}>
            {isLastStep ? 'Concluir' : 'Próximo'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default OnboardingPage
