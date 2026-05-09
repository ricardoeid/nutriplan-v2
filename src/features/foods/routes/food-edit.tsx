import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import {
  editFoodSchema,
  type EditFoodFormData,
  type EditFoodParsedData,
} from '../lib/schemas'
import { useFood } from '../hooks/use-food'
import { useUpdateFood } from '../hooks/use-update-food'

export default function FoodEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { food, isOwn, loading, error } = useFood(id)
  const updateFood = useUpdateFood()

  const form = useForm<EditFoodFormData, unknown, EditFoodParsedData>({
    resolver: zodResolver(editFoodSchema),
    mode: 'onSubmit',
    defaultValues: {
      name: '',
      brand: undefined,
      defaultServingG: undefined as unknown as number,
      servingLabel: undefined,
      recalcWholeUnitsOnly: false,
      kcalPer100g: undefined as unknown as number,
      proteinPer100g: undefined as unknown as number,
      carbPer100g: undefined as unknown as number,
      fatPer100g: undefined as unknown as number,
    },
  })

  // Resetar o form com os dados do food quando ele chegar.
  // Necessário porque defaults são síncronos e o food vem do fetch.
  // `reset()` em vez de `setValue` em cada campo: mantém formState
  // limpo (sem `dirty` flags falsos) e evita re-render por campo.
  useEffect(() => {
    if (!food) return
    form.reset({
      name: food.name,
      brand: food.brand ?? undefined,
      defaultServingG: food.default_serving_g,
      servingLabel: food.serving_label ?? undefined,
      recalcWholeUnitsOnly: food.recalc_whole_units_only,
      kcalPer100g: food.kcal_per_100g,
      proteinPer100g: food.protein_per_100g,
      carbPer100g: food.carb_per_100g,
      fatPer100g: food.fat_per_100g,
    })
  }, [food, form])

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  if (error || !food) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error instanceof Error
            ? error.message
            : 'Alimento não encontrado.'}
        </p>
      </div>
    )
  }

  // Guard: se não é dono, redireciona pro detail (que mostra readonly)
  if (!isOwn) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900">
          Você não pode editar este alimento.
        </p>
        <Button asChild variant="outline">
          <Link to={`/foods/${food.id}`}>Ver detalhes</Link>
        </Button>
      </div>
    )
  }

  const handleSave = async () => {
    const ok = await form.trigger()
    if (!ok) {
      toast.error('Há campos com erro. Revise e tente de novo.')
      return
    }
    const values = form.getValues() as unknown as EditFoodParsedData

    updateFood.mutate(
      { foodId: food.id, data: values },
      {
        onSuccess: () => {
          toast.success('Alterações salvas')
          navigate(`/foods/${food.id}`)
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
        },
      },
    )
  }

  const {
    register,
    formState: { errors },
  } = form

  return (
    <div className="mx-auto max-w-2xl p-4">
      <Card className="w-full">
        <CardHeader>
          <h1 className="text-2xl font-semibold">Editar alimento</h1>
          <p className="text-sm text-muted-foreground">
            Alterações usam valores por 100 g (formato canônico).
          </p>
        </CardHeader>

        <Form {...form}>
          <form onSubmit={(e) => e.preventDefault()}>
            <CardContent className="space-y-4">
              {/* Nome */}
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome *</Label>
                <Input id="name" {...register('name')} />
                {errors.name && (
                  <p className="text-xs text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* Marca */}
              <div className="space-y-1.5">
                <Label htmlFor="brand">Marca (opcional)</Label>
                <Input id="brand" {...register('brand')} />
                {errors.brand && (
                  <p className="text-xs text-destructive">
                    {errors.brand.message}
                  </p>
                )}
              </div>

              {/* Peso da porção */}
              <div className="space-y-1.5">
                <Label htmlFor="defaultServingG">
                  Peso da porção (g) *
                </Label>
                <Input
                  id="defaultServingG"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  {...register('defaultServingG', { valueAsNumber: true })}
                />
                {errors.defaultServingG && (
                  <p className="text-xs text-destructive">
                    {errors.defaultServingG.message}
                  </p>
                )}
              </div>

              {/* Rótulo da porção */}
              <div className="space-y-1.5">
                <Label htmlFor="servingLabel">
                  Rótulo da porção (opcional)
                </Label>
                <Input id="servingLabel" {...register('servingLabel')} />
                {errors.servingLabel && (
                  <p className="text-xs text-destructive">
                    {errors.servingLabel.message}
                  </p>
                )}
              </div>

              {/* Flag inteiros */}
              <div className="flex items-start gap-2 rounded-md border border-input p-3">
                <input
                  type="checkbox"
                  id="recalcWholeUnitsOnly"
                  className="mt-1"
                  {...register('recalcWholeUnitsOnly')}
                />
                <div>
                  <Label
                    htmlFor="recalcWholeUnitsOnly"
                    className="cursor-pointer font-medium"
                  >
                    Apenas múltiplos inteiros da porção
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Marque pra alimentos que só fazem sentido em
                    unidades inteiras (ex: 1, 2, 3 ovos).
                  </p>
                </div>
              </div>

              {/* Macros por 100g */}
              <div className="space-y-3 rounded-md border border-border p-3">
                <h3 className="text-sm font-medium">Por 100 g</h3>
                <div className="space-y-1.5">
                  <Label htmlFor="kcalPer100g">Calorias (kcal) *</Label>
                  <Input
                    id="kcalPer100g"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    {...register('kcalPer100g', { valueAsNumber: true })}
                  />
                  {errors.kcalPer100g && (
                    <p className="text-xs text-destructive">
                      {errors.kcalPer100g.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="proteinPer100g">Proteína (g) *</Label>
                    <Input
                      id="proteinPer100g"
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      {...register('proteinPer100g', {
                        valueAsNumber: true,
                      })}
                    />
                    {errors.proteinPer100g && (
                      <p className="text-xs text-destructive">
                        {errors.proteinPer100g.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="carbPer100g">Carbo (g) *</Label>
                    <Input
                      id="carbPer100g"
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      {...register('carbPer100g', { valueAsNumber: true })}
                    />
                    {errors.carbPer100g && (
                      <p className="text-xs text-destructive">
                        {errors.carbPer100g.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fatPer100g">Gord (g) *</Label>
                    <Input
                      id="fatPer100g"
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      {...register('fatPer100g', { valueAsNumber: true })}
                    />
                    {errors.fatPer100g && (
                      <p className="text-xs text-destructive">
                        {errors.fatPer100g.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                asChild
                disabled={updateFood.isPending}
              >
                <Link to={`/foods/${food.id}`}>Cancelar</Link>
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={updateFood.isPending}
              >
                {updateFood.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  )
}
