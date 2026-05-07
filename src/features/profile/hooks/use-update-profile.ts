import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import {
  calculateAge,
  calculateBMR,
  calculateMacroTargets,
  calculateTDEE,
} from '@/lib/macros'
import { type OnboardingFullData } from '@/features/onboarding/lib/schemas'

type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

interface UpdateProfileInput {
  data: OnboardingFullData
  recalculateTargets: boolean
  // Peso anterior conhecido — usado pra decidir se faz upsert em
  // weight_logs. Se peso não mudou, weight_logs não é tocado.
  previousWeightKg: number | null
}

// Mutation pra editar profile depois do onboarding inicial.
// Lógica de targets:
//   - recalculateTargets=true  → calcula via fórmulas (ignora MacroEditor)
//   - recalculateTargets=false → usa valores manuais do MacroEditor
//                                (vindo em data.calorie/protein/carb/fat Target)
export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      const { data, recalculateTargets, previousWeightKg } = input

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Usuário não autenticado')
      }

      // Campos sempre atualizados (independem de recalc)
      const updatePayload: ProfileUpdate = {
        display_name: data.displayName,
        sex: data.sex,
        birth_date: data.birthDate,
        height_cm: data.heightCm,
        weight_kg: data.weightKg,
        activity_level: data.activityLevel,
        goal: data.goal,
      }

      if (recalculateTargets) {
        // Calcular via fórmulas
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
        updatePayload.calorie_target = targets.calorieTarget
        updatePayload.protein_target = targets.proteinTarget
        updatePayload.carb_target = targets.carbTarget
        updatePayload.fat_target = targets.fatTarget
      } else {
        // Usar valores editados manualmente, se vieram. Se algum não veio,
        // não enviar (banco mantém o atual).
        if (typeof data.calorieTarget === 'number') {
          updatePayload.calorie_target = data.calorieTarget
        }
        if (typeof data.proteinTarget === 'number') {
          updatePayload.protein_target = data.proteinTarget
        }
        if (typeof data.carbTarget === 'number') {
          updatePayload.carb_target = data.carbTarget
        }
        if (typeof data.fatTarget === 'number') {
          updatePayload.fat_target = data.fatTarget
        }
      }

      // 1. UPDATE profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', user.id)

      if (profileError) {
        throw new Error(`Erro ao salvar perfil: ${profileError.message}`)
      }

      // 2. UPSERT weight_logs SE peso mudou
      // Não envia logged_on — banco usa default ((now() AT TIME ZONE
      // 'America/Sao_Paulo')::date) da migration 8.5. Conflict resolve
      // por (user_id, logged_on): mesmo dia → update da row existente.
      if (previousWeightKg !== data.weightKg) {
        const { error: weightError } = await supabase
          .from('weight_logs')
          .upsert(
            {
              user_id: user.id,
              weight_kg: data.weightKg,
            },
            { onConflict: 'user_id,logged_on' },
          )

        if (weightError) {
          console.warn('Failed to upsert weight log:', weightError)
        }
      }

      return { userId: user.id }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}
