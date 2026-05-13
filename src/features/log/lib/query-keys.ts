// Query keys da feature `log`. Centralizadas pra invalidação consistente
// quando mutations (add/delete entry, delete meal, create meal) acontecem.
//
//   queryClient.invalidateQueries({ queryKey: logKeys.all })
//     → derruba TODOS os dias em cache. Use com parcimônia (só em
//        eventos globais tipo trocar de user via logout/login).
//
//   queryClient.invalidateQueries({ queryKey: ['log', 'daily'] })
//     → invalida o dia inteiro de qualquer data. Útil quando uma mutation
//        pode afetar múltiplos dias (não acontece na Fase 4, mas
//        substituição na Fase 6 vai usar isso).
//
//   queryClient.invalidateQueries({ queryKey: logKeys.daily(dateISO) })
//     → invalida só um dia específico. Padrão default pra add/delete
//        entry na Fase 4.
//
// O parâmetro `dateISO` é a data formato YYYY-MM-DD (não Date object) —
// strings são estáveis como chave de cache, Date objects mudam por ref.
export const logKeys = {
  all: ['log'] as const,
  daily: (dateISO: string) => ['log', 'daily', dateISO] as const,
}
