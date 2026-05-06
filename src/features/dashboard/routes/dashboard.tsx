import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { supabase } from "@/lib/supabase"

function DashboardPage() {
  const { user, signOut } = useAuth()

  const { data: count, isLoading, error } = useQuery({
    queryKey: ["foods-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("foods")
        .select("*", { count: "exact", head: true })
      if (error) throw error
      return count
    },
  })

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-4 p-8">
      <div className="absolute top-4 right-4 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{user?.email}</span>
        <Button variant="outline" size="sm" onClick={signOut}>
          Sair
        </Button>
      </div>

      <h1 className="text-4xl font-bold">NutriPlan</h1>
      {error && <p className="text-destructive">Erro: {error.message}</p>}
      {count !== null && count !== undefined && (
        <p className="text-xl">{count} alimentos cadastrados</p>
      )}
      {isLoading && <p className="text-muted-foreground">Carregando...</p>}
      <Button>Botão de teste</Button>
    </div>
  )
}

export default DashboardPage
