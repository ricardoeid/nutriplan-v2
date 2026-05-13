// Helpers de data em timezone BR (America/Sao_Paulo).
//
// Por que isso existe: `daily_logs.log_date` é coluna `date` pura (sem
// timezone). Toda comparação/criação client tem que decidir "que data
// é hoje" antes de mandar pro banco. Se decidir em UTC, usuário do BR
// que loga depois das 21h cai pro próximo dia (off-by-one), igual ao
// bug que custou a migration 8.5 em weight_logs.
//
// Formato canônico em strings: ISO date 'YYYY-MM-DD'. Estável como key
// de cache, fácil de comparar lexicograficamente (a < b ↔ a anterior).

const BR_TZ = 'America/Sao_Paulo'

// Data atual em BR no formato YYYY-MM-DD.
// `en-CA` é o locale que naturalmente formata YYYY-MM-DD com Intl.
export function getTodayBR(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: BR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(new Date())
}

// Soma `days` (pode ser negativo) a uma data YYYY-MM-DD, devolve YYYY-MM-DD.
// Aritmética via Date.UTC pra ignorar timezone — só importa o calendário.
export function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d))
  utc.setUTCDate(utc.getUTCDate() + days)
  return utc.toISOString().slice(0, 10)
}

// Formata YYYY-MM-DD pra DD/MM (display brasileiro, sem ano).
export function formatDateDDMM(dateISO: string): string {
  const [, m, d] = dateISO.split('-')
  return `${d}/${m}`
}

// Formata YYYY-MM-DD pra DD/MM/YYYY (quando precisar do ano).
export function formatDateDDMMYYYY(dateISO: string): string {
  const [y, m, d] = dateISO.split('-')
  return `${d}/${m}/${y}`
}
