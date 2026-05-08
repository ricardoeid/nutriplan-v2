import { useEffect, useState } from 'react'

// Atrasa a propagação de um valor por `delayMs` ms. Cada nova mudança
// reseta o timer; só quando o valor "estabiliza" (sem mudança nesse
// intervalo) o hook retorna o novo valor.
//
// Uso típico em busca: o input é controlled (estado React imediato)
// e o `debouncedValue` é o que dispara a query — assim a UI fica
// responsiva enquanto a RPC só chama depois da pausa.
//
// Se virar útil em outras features, mover pra src/lib/.
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debouncedValue
}
