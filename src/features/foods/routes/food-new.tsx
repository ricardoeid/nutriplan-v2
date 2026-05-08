import { Link, useNavigate } from 'react-router-dom'
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

import {
  customFoodSchema,
  type CustomFoodFormData,
  type CustomFoodParsedData,
} from '../lib/schemas'
import { useCreateFood } from '../hooks/use-create-food'
import { FoodFormModeSelect } from '../components/food-form-mode-select'
import { FoodFormFields } from '../components/food-form-fields'
import { FoodFormMacros100g } from '../components/food-form-macros-100g'
import { FoodFormMacrosServing } from '../components/food-form-macros-serving'

// Defaults aplicados a TODOS os campos. Necessário porque RHF precisa
// de defaults pra registrar campos com `valueAsNumber` corretamente
// (sem isso, valores numéricos em branco dão `''` em vez de `NaN`,
// e o zod aceita strings vazias por engano).
//
// Tipados como `CustomFoodFormData` (z.input) — campos opcionais
// (brand, servingLabel) podem ficar como `undefined`. Numéricos
// começam `undefined` e o zod rejeita até user preencher.
const DEFAULTS: CustomFoodFormData = {
  mode: 'per100g',
  name: '',
  brand: undefined,
  defaultServingG: undefined as unknown as number,
  servingLabel: undefined,
  recalcWholeUnitsOnly: false,
  kcalPer100g: undefined as unknown as number,
  proteinPer100g: undefined as unknown as number,
  carbPer100g: undefined as unknown as number,
  fatPer100g: undefined as unknown as number,
}

function FoodNewPage() {
  const navigate = useNavigate()
  const createFood = useCreateFood()

  // useForm<Input, _, Output>: 3 generics necessários pra discriminated
  // union casar. O resolver retorna Output (parseado), o form trabalha
  // com Input (display). Sem os 3 generics, RHF v8 cai em FieldValues
  // e quebra a inferência das props dos sub-componentes.
  const form = useForm<CustomFoodFormData, unknown, CustomFoodParsedData>({
    resolver: zodResolver(customFoodSchema),
    mode: 'onSubmit',
    defaultValues: DEFAULTS,
  })

  const mode = form.watch('mode')

  const handleModeChange = (newMode: typeof mode) => {
    // Troca de modo: limpa os campos do MODO ANTIGO pra evitar que
    // valores ficassem "fantasma" no estado e o zod rejeitasse no
    // submit (discriminated union exige que SÓ os campos do modo
    // ativo estejam presentes).
    form.setValue('mode', newMode)
    if (newMode === 'per100g') {
      form.setValue('kcalPerServing' as never, undefined as never)
      form.setValue('proteinPerServing' as never, undefined as never)
      form.setValue('carbPerServing' as never, undefined as never)
      form.setValue('fatPerServing' as never, undefined as never)
    } else {
      form.setValue('kcalPer100g' as never, undefined as never)
      form.setValue('proteinPer100g' as never, undefined as never)
      form.setValue('carbPer100g' as never, undefined as never)
      form.setValue('fatPer100g' as never, undefined as never)
    }
  }

  const handleSave = async () => {
    const ok = await form.trigger()
    if (!ok) {
      toast.error('Há campos com erro. Revise e tente de novo.')
      return
    }

    // form.getValues() retorna o tipo de Input — depois do trigger()
    // bem-sucedido sabemos que parseia ok, então cast pra Parsed é
    // seguro. Alternativa seria chamar o schema.parse() de novo aqui,
    // mas redundante.
    const values = form.getValues() as unknown as CustomFoodParsedData

    createFood.mutate(values, {
      onSuccess: () => {
        toast.success('Alimento criado')
        navigate('/foods')
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
      },
    })
  }

  return (
    <div className="mx-auto max-w-2xl p-4">
      <Card className="w-full">
        <CardHeader>
          <h1 className="text-2xl font-semibold">Novo alimento</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre um alimento que não está na nossa base.
          </p>
        </CardHeader>

        <Form {...form}>
          <form onSubmit={(e) => e.preventDefault()}>
            <CardContent className="space-y-6">
              <FoodFormFields form={form} />

              <FoodFormModeSelect
                value={mode}
                onChange={handleModeChange}
                disabled={createFood.isPending}
              />

              {mode === 'per100g' ? (
                <FoodFormMacros100g form={form} />
              ) : (
                <FoodFormMacrosServing form={form} />
              )}
            </CardContent>

            <CardFooter className="flex justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                asChild
                disabled={createFood.isPending}
              >
                <Link to="/foods">Cancelar</Link>
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={createFood.isPending}
              >
                {createFood.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  )
}

export default FoodNewPage
