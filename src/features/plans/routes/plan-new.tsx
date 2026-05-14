import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

import { useCreatePlan } from '../hooks/use-create-plan'

// Schema inline porque é 1 campo só — não vale arquivo dedicado.
// .trim() aplica antes de min(1), então user que digitar só espaços
// recebe erro de "vazio".
const planNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Dê um nome ao plano')
    .max(80, 'Nome muito longo (máx. 80 caracteres)'),
})

type PlanNameInput = z.input<typeof planNameSchema>
type PlanNameOutput = z.output<typeof planNameSchema>

const DEFAULTS: PlanNameInput = { name: '' }

export default function PlanNewPage() {
  const navigate = useNavigate()
  const createPlan = useCreatePlan()

  // 3 generics no useForm — mesmo padrão de food-new.tsx (§3 padrão 7
  // do STATUS). Mesmo com 1 campo só, manter consistência ajuda futuro
  // Claude / Ricardo a não estranhar.
  const form = useForm<PlanNameInput, unknown, PlanNameOutput>({
    resolver: zodResolver(planNameSchema),
    mode: 'onSubmit',
    defaultValues: DEFAULTS,
  })

  const handleSave = async () => {
    const ok = await form.trigger()
    if (!ok) {
      toast.error('Há campos com erro. Revise e tente de novo.')
      return
    }
    const values = form.getValues() as unknown as PlanNameOutput

    createPlan.mutate(values, {
      onSuccess: (newPlan) => {
        toast.success(`"${newPlan.name}" criado`)
        // Redireciona direto pro editor — B3 já implementa a rota.
        // replace: true pra não acumular /planos/novo no histórico.
        navigate(`/planos/${newPlan.id}/editar`, { replace: true })
      },
      onError: (err) => {
        toast.error(
          err instanceof Error
            ? `Erro ao criar: ${err.message}`
            : 'Erro ao criar plano.',
        )
      },
    })
  }

  return (
    <div className="mx-auto max-w-2xl p-4 pb-24">
      <Card className="w-full">
        <CardHeader>
          <h1 className="text-2xl font-semibold">Novo plano</h1>
          <p className="text-sm text-muted-foreground">
            Comece dando um nome. As refeições, slots e opções entram no
            editor depois.
          </p>
        </CardHeader>

        <Form {...form}>
          <form onSubmit={(e) => e.preventDefault()}>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do plano</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Ex: Cutting verão, Bulk 3000kcal"
                        autoFocus
                        disabled={createPlan.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>

            <CardFooter className="flex justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                asChild
                disabled={createPlan.isPending}
              >
                <Link to="/planos">Cancelar</Link>
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={createPlan.isPending}
              >
                {createPlan.isPending ? 'Criando…' : 'Criar plano'}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  )
}
