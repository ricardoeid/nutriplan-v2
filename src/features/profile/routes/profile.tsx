import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'

import { useAuth } from '@/features/auth/hooks/useAuth'
import { useProfile } from '@/features/profile/hooks/use-profile'
import {
  formatActivityLevel,
  formatDateBR,
  formatGoal,
  formatSex,
} from '@/lib/utils-format'
import type { ActivityLevel, Goal, Sex } from '@/lib/macros'

import { HiddenFoodsSection } from '@/features/foods/components/hidden-foods-section'

function ProfilePage() {
  const { signOut } = useAuth()
  const { profile, loading } = useProfile()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Perfil não encontrado.</p>
      </div>
    )
  }

  // Casts: o tipo gerado pelo Supabase trata enums como string genérico.
  // Como AuthGuard só deixa entrar com onboarding_completed=true, todos
  // os campos abaixo já estão preenchidos com valores válidos.
  const rows: Array<[string, string]> = [
    ['Nome', profile.display_name ?? '--'],
    ['Sexo', profile.sex ? formatSex(profile.sex as Sex) : '--'],
    [
      'Nascimento',
      profile.birth_date ? formatDateBR(profile.birth_date) : '--',
    ],
    ['Altura', profile.height_cm != null ? `${profile.height_cm} cm` : '--'],
    ['Peso', profile.weight_kg != null ? `${profile.weight_kg} kg` : '--'],
    [
      'Atividade',
      profile.activity_level
        ? formatActivityLevel(profile.activity_level as ActivityLevel)
        : '--',
    ],
    ['Objetivo', profile.goal ? formatGoal(profile.goal as Goal) : '--'],
  ]

  const targets: Array<[string, string]> = [
    ['Calorias', profile.calorie_target != null ? `${profile.calorie_target} kcal` : '--'],
    ['Proteína', profile.protein_target != null ? `${profile.protein_target} g` : '--'],
    ['Carboidrato', profile.carb_target != null ? `${profile.carb_target} g` : '--'],
    ['Gordura', profile.fat_target != null ? `${profile.fat_target} g` : '--'],
  ]

  // Layout: items-start + py-8 em vez de items-center porque a página
  // agora pode crescer (HiddenFoodsSection expandida) e items-center
  // cortaria o topo em telas pequenas. py-8 dá respiro em telas
  // grandes onde o conteúdo é curto.
  // max-w-2xl alinha com /foods pra consistência visual.
  return (
    <div className="min-h-screen flex items-start justify-center p-4 py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <h1 className="text-2xl font-semibold">Seu perfil</h1>
        </CardHeader>

        <CardContent className="space-y-6">
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">
              Dados pessoais
            </h2>
            <dl className="space-y-2">
              {rows.map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between border-b border-input pb-2 text-sm"
                >
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">
              Metas diárias
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {targets.map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-md border border-input p-3 text-center"
                >
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="text-lg font-semibold">{value}</div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">
              Preferências
            </h2>
            <HiddenFoodsSection />
          </section>
        </CardContent>

        <CardFooter className="flex justify-between gap-2">
          <Button variant="outline" asChild>
            <Link to="/dashboard">Voltar</Link>
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/profile/edit">Editar</Link>
            </Button>
            <Button variant="destructive" onClick={() => signOut()}>
              Sair
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

export default ProfilePage
