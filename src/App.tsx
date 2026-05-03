import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"

function App() {
  const [count, setCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from("foods")
      .select("*", { count: "exact", head: true })
      .then(({ count, error }) => {
        if (error) setError(error.message)
        else setCount(count)
      })
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">NutriPlan</h1>
      {error && <p className="text-destructive">Erro: {error}</p>}
      {count !== null && <p className="text-xl">{count} alimentos cadastrados</p>}
      {count === null && !error && <p className="text-muted-foreground">Carregando...</p>}
      <Button>Botão de teste</Button>
    </div>
  )
}

export default App