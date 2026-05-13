import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import {
  calculateAge,
  calculateBMR,
  calculateMacroTargets,
  calculateTDEE,
} from '@/lib/macros'
import { type OnboardingFullData } from '../lib/schemas'

// Mutation que finaliza o onboarding:
//   1. UPDATE profiles (todos os campos + onboarding_completed=true)
//   2. INSERT weight_logs (peso atual, data = hoje pelo default do banco)
//
// Em sucesso, invalida cache do profile pra que o AuthGuard receba o
// valor atualizado (onboarding_completed=true) e libere /.
// Sem isso, o cache stale enviaria o user de volta pra /onboarding em
// loop logo após o navigate.
//
// Tratamento de erro: se UPDATE falhar, aborta. Se INSERT falhar mas
// UPDATE já passou, considera onboarding completo (a row de peso é
// nice-to-have). Estado consistente o suficiente; transação real fica
// pra fase futura se virar problema.
export function useCompleteOnboarding() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: OnboardingFullData) => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Usuário não autenticado')
      }

      // Calcular targets
      const age = calculateAge(new Date(data.birthDate))
      const bmr = calculateBMR({
        sex: data.sex,
        ageYears: age,
        heightCm: data.heightCm,
        weightKg: data.weightKg,
      })
      const tdee = calculateTDEE(bmr, data.activityLevel)
      const targets = calculateMacroTargets({
        tdee,
        goal: data.goal,
        weightKg: data.weightKg,
      })

      // 1. UPDATE profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          display_name: data.displayName,
          sex: data.sex,
          birth_date: data.birthDate,
          height_cm: data.heightCm,
          weight_kg: data.weightKg,
          activity_level: data.activityLevel,
          goal: data.goal,
          calorie_target: targets.calorieTarget,
          protein_target: targets.proteinTarget,
          carb_target: targets.carbTarget,
          fat_target: targets.fatTarget,
          onboarding_completed: true,
        })
        .eq('id', user.id)

      if (profileError) {
        throw new Error(`Erro ao salvar perfil: ${profileError.message}`)
      }

      // 2. INSERT weight_logs (best effort — não falha o onboarding)
      const { error: weightError } = await supabase
        .from('weight_logs')
        .insert({
          user_id: user.id,
          weight_kg: data.weightKg,
          // logged_on usa default CURRENT_DATE do banco
        })

      if (weightError) {
        // Loga mas não throws — onboarding considera-se completo
        console.warn('Failed to insert initial weight log:', weightError)
      }

      return { userId: user.id }
    },
    onSuccess: (_, _data) => {
      // Invalida o cache pra forçar re-fetch do profile.
      // queryKey precisa bater com o usado em useProfile: ['profile', userId]
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}
