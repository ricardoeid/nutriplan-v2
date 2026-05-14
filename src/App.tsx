import { BrowserRouter, Routes, Route } from "react-router-dom"

import { Toaster } from "@/components/ui/sonner"
import { AuthGuard } from "@/features/auth/components/auth-guard"
import HomePage from "@/features/log/routes/home"
import LoginPage from "@/features/auth/routes/login"
import SignupPage from "@/features/auth/routes/signup"
import OnboardingPage from "@/features/onboarding/routes/onboarding"
import { OnboardingGuard } from "@/features/onboarding/components/onboarding-guard"
import ProfilePage from "@/features/profile/routes/profile"
import ProfileEditPage from "@/features/profile/routes/profile-edit"
import FoodsPage from "@/features/foods/routes/foods"
import FoodNewPage from "@/features/foods/routes/food-new"
import FoodDetailPage from "@/features/foods/routes/food-detail"
import FoodEditPage from "@/features/foods/routes/food-edit"
import PlanoPage from "@/features/plans/routes/plano"
import PlansPage from "@/features/plans/routes/plans"
import PlanNewPage from "@/features/plans/routes/plan-new"
import PlanEditPage from "@/features/plans/routes/plan-edit"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <AuthGuard>
              <HomePage />
            </AuthGuard>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/onboarding"
          element={
            <OnboardingGuard>
              <OnboardingPage />
            </OnboardingGuard>
          }
        />
        <Route
          path="/profile"
          element={
            <AuthGuard>
              <ProfilePage />
            </AuthGuard>
          }
        />
        <Route
          path="/profile/edit"
          element={
            <AuthGuard>
              <ProfileEditPage />
            </AuthGuard>
          }
        />
        <Route
          path="/foods"
          element={
            <AuthGuard>
              <FoodsPage />
            </AuthGuard>
          }
        />
        <Route
          path="/foods/new"
          element={
            <AuthGuard>
              <FoodNewPage />
            </AuthGuard>
          }
        />
        <Route
          path="/foods/:id"
          element={
            <AuthGuard>
              <FoodDetailPage />
            </AuthGuard>
          }
        />
        <Route
          path="/foods/:id/edit"
          element={
            <AuthGuard>
              <FoodEditPage />
            </AuthGuard>
          }
        />
        <Route
          path="/plano"
          element={
            <AuthGuard>
              <PlanoPage />
            </AuthGuard>
          }
        />
        <Route
          path="/planos"
          element={
            <AuthGuard>
              <PlansPage />
            </AuthGuard>
          }
        />
        <Route
          path="/planos/novo"
          element={
            <AuthGuard>
              <PlanNewPage />
            </AuthGuard>
          }
        />
        <Route
          path="/planos/:id/editar"
          element={
            <AuthGuard>
              <PlanEditPage />
            </AuthGuard>
          }
        />
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}

export default App
