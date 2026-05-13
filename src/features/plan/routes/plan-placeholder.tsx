import { CalendarDays } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

// Placeholder da rota /plano. A feature de planos alimentares completa
// vem na Fase 5 (criar plano, editar, ativar, ver hoje aplicado). Até
// lá, esta rota existe pra que a tab "Plano" do BottomNav navegue pra
// algum lugar honesto em vez de quebrar ou ficar disabled (decidido com
// Ricardo: placeholder é mais transparente que disabled).
function PlanPlaceholderPage() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <main className="max-w-md mx-auto p-8 flex flex-col items-center justify-center gap-4 pt-24 text-center">
        <CalendarDays className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Em breve</h1>
        <p className="text-muted-foreground">
          Criação e gestão de planos alimentares está chegando. Por
          enquanto, você pode logar livremente no diário.
        </p>
        <Button asChild className="mt-2">
          <Link to="/">Voltar pro diário</Link>
        </Button>
      </main>
    </div>
  )
}

export default PlanPlaceholderPage
