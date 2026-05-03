import { Link } from "react-router-dom"

function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold">NutriPlan</h1>
      <p className="text-muted-foreground">Controle de macros e calorias</p>
      <div className="flex gap-4">
        <Link
          to="/login"
          className="text-primary underline-offset-4 hover:underline"
        >
          Entrar
        </Link>
        <Link
          to="/signup"
          className="text-primary underline-offset-4 hover:underline"
        >
          Criar conta
        </Link>
      </div>
    </div>
  )
}

export default HomePage
