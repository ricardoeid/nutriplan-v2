import type { LogMealWithEntries } from '../lib/types'

interface AddFoodMealPickerStepProps {
  meals: LogMealWithEntries[]
  onPick: (mealId: string) => void
  onCancel: () => void
}

// Step 1 do AddFoodFlow: usuário escolhe em qual refeição vai logar o
// alimento. Lista das log_meals do dia como botões empilhados (mais
// mobile-friendly que radio + Confirmar).
//
// Usado quando o flow é disparado de fora de uma meal específica (B8 da
// Fase 4: clicar "+" no FoodRow de /foods). Quando o flow é disparado
// de DENTRO de uma MealCard (B7), essa step é pulada — vai direto pra
// quantity.
//
// Mostra contagem de entries existentes como hint discreto.
export function AddFoodMealPickerStep({
  meals,
  onPick,
  onCancel,
}: AddFoodMealPickerStepProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Em qual refeição vai entrar?
      </p>

      {meals.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-card px-3 py-6 text-center text-sm text-muted-foreground">
          Nenhuma refeição neste dia. Cancele e crie uma primeiro.
        </p>
      ) : (
        <ul className="space-y-1">
          {meals.map((meal) => (
            <li key={meal.id}>
              <button
                type="button"
                onClick={() => onPick(meal.id)}
                className="w-full rounded-md border border-border bg-card px-3 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="font-medium block">{meal.name}</span>
                <span className="text-xs text-muted-foreground">
                  {meal.entries.length === 0
                    ? 'Sem alimentos ainda'
                    : `${meal.entries.length} alimento${meal.entries.length === 1 ? '' : 's'}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
