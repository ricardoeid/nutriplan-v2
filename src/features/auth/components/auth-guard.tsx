import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"

import { BottomNav } from "@/shared/components/bottom-nav"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { useProfile } from "@/features/profile/hooks/use-profile"

// Estados:
//   sem user                          → /login
//   profile carregando                → "Carregando..."
//   onboarding_completed = false/null → /onboarding
//   onboarding_completed = true       → renderiza children + BottomNav
//
// BottomNav aparece SEMPRE que children renderiza (todas rotas autenticadas).
// As rotas individuais (Home, Foods, Profile, etc.) já reservam `pb-24`
// no container raiz pra não esconderem conteúdo atrás da nav fixed.
export function AuthGuard({ children }: { children: ReactNode }) {
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

  if (!profile?.onboarding_completed) {
    return <Navigate to="/onboarding" replace />
  }

  return (
    <>
      {children}
      <BottomNav />
    </>
  )
}
