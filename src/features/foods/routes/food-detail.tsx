import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, Pencil, Star } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { useFood } from '../hooks/use-food'
import { useToggleHide } from '../hooks/use-toggle-hide'

const SOURCE_LABELS: Record<string, string> = {
  taco: 'TACO (base brasileira)',
  open_food_facts: 'Open Food Facts',
  composite: 'Receita',
  custom: 'Cadastrado por você',
}

function formatGrams(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })
}

function formatKcal(value: number | null | undefined): string {
  if (value == null) return '—'
  return Math.round(value).toLocaleString('pt-BR')
}

export default function FoodDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { food, isFavorite, isHidden, isOwn, loading, error } = useFood(id)
  const toggleHide = useToggleHide()

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-4 pb-24">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  if (error || !food) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
        <Button variant="outline" size="sm" onClick={() => navigate('/foods')}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Button>
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error instanceof Error
            ? error.message
            : 'Alimento não encontrado.'}
        </p>
      </div>
    )
  }

  // Click no botão Ocultar/Desocultar. Mesma lógica do foods.tsx —
  // dispara mutation e mostra toast com undo de 5s.
  const handleToggleHide = () => {
    toggleHide.mutate(
      { foodId: food.id, currentIsHidden: isHidden },
      {
        onSuccess: () => {
          const wasHidden = isHidden
          const message = wasHidden
            ? `"${food.name}" desocultado`
            : `"${food.name}" ocultado`
          toast.success(message, {
            duration: 5000,
            action: {
              label: 'Desfazer',
              onClick: () => {
                toggleHide.mutate({
                  foodId: food.id,
                  currentIsHidden: !wasHidden,
                })
              },
            },
          })
        },
      },
    )
  }

  // Macros por porção (calculadas a partir do per-100g + serving)
  const factor = food.default_serving_g / 100
  const kcalServing = food.kcal_per_100g * factor
  const proteinServing = food.protein_per_100g * factor
  const carbServing = food.carb_per_100g * factor
  const fatServing = food.fat_per_100g * factor

  const sourceLabel = SOURCE_LABELS[food.source] ?? food.source
  const servingDisplay = food.serving_label
    ? `${food.serving_label} (${formatGrams(food.default_serving_g)} g)`
    : `${formatGrams(food.default_serving_g)} g`

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/foods')}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleHide}
            disabled={toggleHide.isPending}
          >
            {isHidden ? (
              <>
                <Eye className="mr-1 h-4 w-4" />
                Desocultar
              </>
            ) : (
              <>
                <EyeOff className="mr-1 h-4 w-4" />
                Ocultar
              </>
            )}
          </Button>
          {isOwn && (
            <Button asChild size="sm">
              <Link to={`/foods/${food.id}/edit`}>
                <Pencil className="mr-1 h-4 w-4" />
                Editar
              </Link>
            </Button>
          )}
        </div>
      </div>

      {isHidden && (
        <p
          className={cn(
            'rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs',
            'text-amber-800',
          )}
        >
          Este alimento está oculto. Não aparece na busca até você
          desocultar.
        </p>
      )}

      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-2xl font-semibold">{food.name}</h1>
            {isFavorite && (
              <Star
                aria-label="Favoritado"
                className="mt-1 h-5 w-5 shrink-0 fill-amber-400 text-amber-400"
              />
            )}
          </div>
          {food.brand && (
            <p className="text-sm text-muted-foreground">{food.brand}</p>
          )}
          <p className="text-xs text-muted-foreground">{sourceLabel}</p>
        </CardHeader>

        <CardContent className="space-y-6">
          <section>
            <h2 className="mb-2 text-sm font-medium">
              Por porção: {servingDisplay}
            </h2>
            <dl className="grid grid-cols-4 gap-2 rounded-md border border-border bg-muted/30 p-3 text-center">
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Kcal
                </dt>
                <dd className="text-lg font-semibold">
                  {formatKcal(kcalServing)}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Prot
                </dt>
                <dd className="text-lg font-semibold">
                  {formatGrams(proteinServing)} g
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Carb
                </dt>
                <dd className="text-lg font-semibold">
                  {formatGrams(carbServing)} g
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Gord
                </dt>
                <dd className="text-lg font-semibold">
                  {formatGrams(fatServing)} g
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">
              Por 100 g (referência)
            </h2>
            <dl className="grid grid-cols-4 gap-2 text-center text-xs text-muted-foreground">
              <div>
                <dt>Kcal</dt>
                <dd className="font-medium text-foreground">
                  {formatKcal(food.kcal_per_100g)}
                </dd>
              </div>
              <div>
                <dt>Prot</dt>
                <dd className="font-medium text-foreground">
                  {formatGrams(food.protein_per_100g)} g
                </dd>
              </div>
              <div>
                <dt>Carb</dt>
                <dd className="font-medium text-foreground">
                  {formatGrams(food.carb_per_100g)} g
                </dd>
              </div>
              <div>
                <dt>Gord</dt>
                <dd className="font-medium text-foreground">
                  {formatGrams(food.fat_per_100g)} g
                </dd>
              </div>
            </dl>
          </section>

          {(food.fiber_per_100g != null ||
            food.sugar_per_100g != null ||
            food.saturated_fat_per_100g != null ||
            food.sodium_mg_per_100g != null) && (
            <section>
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                Adicionais (por 100 g)
              </h2>
              <ul className="space-y-1 text-xs">
                {food.fiber_per_100g != null && (
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">Fibra</span>
                    <span>{formatGrams(food.fiber_per_100g)} g</span>
                  </li>
                )}
                {food.sugar_per_100g != null && (
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">Açúcar</span>
                    <span>{formatGrams(food.sugar_per_100g)} g</span>
                  </li>
                )}
                {food.saturated_fat_per_100g != null && (
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">
                      Gordura saturada
                    </span>
                    <span>
                      {formatGrams(food.saturated_fat_per_100g)} g
                    </span>
                  </li>
                )}
                {food.sodium_mg_per_100g != null && (
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">Sódio</span>
                    <span>
                      {formatGrams(food.sodium_mg_per_100g)} mg
                    </span>
                  </li>
                )}
              </ul>
            </section>
          )}

          {food.recalc_whole_units_only && (
            <p
              className={cn(
                'rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs',
                'text-amber-800',
              )}
            >
              Esse alimento aceita apenas múltiplos inteiros da porção
              padrão (1, 2, 3...).
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
