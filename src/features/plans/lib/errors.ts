// Erros estruturados do save de plano. Usar `instanceof` no caller pra
// distinguir validação (mostra toast amigável) de erro de banco (mostra
// mensagem genérica + log).

export class PlanValidationError extends Error {
  // Lista pode ter múltiplos problemas. O caller decide se mostra só
  // o primeiro ou todos. Pra MVP, mostramos o primeiro pra não
  // sobrecarregar — user resolve um por um.
  readonly issues: string[]

  constructor(issues: string[]) {
    super(issues[0] ?? 'Plano inválido')
    this.name = 'PlanValidationError'
    this.issues = issues
  }
}
