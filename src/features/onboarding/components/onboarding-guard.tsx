import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"

import { useAuth } from "@/features/auth/hooks/useAuth"
import { useProfile } from "@/features/profile/hooks/use-profile"

// Espelho do AuthGuard, mas pra rota /onboarding:
//   sem user                          → /login
//   profile carregando                → "Carregando..."
//   onboarding_completed = true       → / (já fez, não repete)
//   onboarding_completed = false/null → renderiza onboarding
export function OnboardingGuard({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const { profile, loading: profileLoading } = useProfile()

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  if (profile?.onboarding_completed) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
