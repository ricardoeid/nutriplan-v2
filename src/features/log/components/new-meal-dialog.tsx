import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

// Dialog manual (sem @radix-ui/react-dialog) pra criar uma refeição
// (log_meal) sem vínculo de plano. Convenção V1 mobile-first: aparece
// como bottom-sheet em telas pequenas (items-end), modal centralizado
// em sm+ (sm:items-center). Backdrop captura click pra fechar; tecla
// Esc também fecha.
//
// Form com RHF + zod no padrão estabelecido nas Fases 2 e 3:
//   - useForm com generic implícito
//   - submit via Button type="button" + onClick
//   - onSubmit={preventDefault} no form pra evitar submit por Enter
//     em outros campos
//
// `target_time` opcional — o `type="time"` do <Input> retorna string
// HH:MM ou "" vazia. Vazio → undefined no submit pra o hook gravar null.

const newMealSchema = z.object({
  name: z.string().trim().min(1, 'Informe um nome'),
  target_time: z.string().optional(),
})

type NewMealValues = z.infer<typeof newMealSchema>

interface NewMealDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: { name: string; target_time?: string }) => void
  submitting: boolean
}

export function NewMealDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting,
}: NewMealDialogProps) {
  const form = useForm<NewMealValues>({
    resolver: zodResolver(newMealSchema),
    mode: 'onSubmit',
    defaultValues: { name: '', target_time: '' },
  })

  // Reset form quando dialog fecha. Garante que ao reabrir comece limpo
  // (mesmo após erro de validação ou submit prévio).
  useEffect(() => {
    if (!open) form.reset({ name: '', target_time: '' })
  }, [open, form])

  // Esc fecha o dialog. Só registra listener enquanto open.
  useEffect(() => {
    if (!open) return
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onOpenChange])

  // Body scroll lock enquanto aberto.
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  if (!open) return null

  const handleSave = async () => {
    const ok = await form.trigger()
    if (!ok) return
    const values = form.getValues()
    onSubmit({
      name: values.name.trim(),
      // "" → undefined pro hook gravar null em target_time
      target_time: values.target_time?.trim() || undefined,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={() => onOpenChange(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-meal-title"
    >
      <div
        className="w-full max-w-md space-y-4 rounded-t-xl bg-background p-4 sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="new-meal-title" className="text-lg font-semibold">
          Adicionar refeição
        </h2>
        <Form {...form}>
          <form
            onSubmit={(e) => e.preventDefault()}
            className="space-y-3"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="ex: Pré-treino"
                      autoFocus
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="target_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Horário (opcional)</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={submitting}
              >
                {submitting ? 'Adicionando...' : 'Adicionar'}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}
