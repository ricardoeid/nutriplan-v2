import { useContext } from "react"

import { AuthContext } from "@/features/auth/context/auth-context"

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) {
    throw new Error("useAuth deve ser usado dentro de <AuthProvider>")
  }
  return ctx
}
