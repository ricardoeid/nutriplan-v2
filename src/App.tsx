import { BrowserRouter, Routes, Route } from "react-router-dom"

import { Toaster } from "@/components/ui/sonner"
import { AuthGuard } from "@/features/auth/components/auth-guard"
import HomePage from "@/features/home/routes/index"
import LoginPage from "@/features/auth/routes/login"
import SignupPage from "@/features/auth/routes/signup"
import DashboardPage from "@/features/dashboard/routes/dashboard"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/dashboard"
          element={
            <AuthGuard>
              <DashboardPage />
            </AuthGuard>
          }
        />
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}

export default App
