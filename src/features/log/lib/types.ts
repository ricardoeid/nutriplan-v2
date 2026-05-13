// Tipos compartilhados da feature `log` (diário diário).
//
// Os tipos `DailyLog`, `LogMeal`, `LogEntry` vêm direto do schema gerado
// (`@/types/database`), porque essas tabelas têm nullability honesta no
// generated. Já `LogEntryWithFood` e `LogMealWithEntries` são tipagens
// manuais pra capturar o shape do nested select que o `useDailyLog`
// monta — Supabase não gera tipo decente pra select aninhado custom.
//
// Snapshot pattern (§4 do STATUS): `log_entries.kcal/protein/carbs/fat`
// já guardam macros computados no momento do log. Não recalcular a
// partir de `food.*_per_100g` na exibição — usar os campos diretos.

import type { Database } from '@/types/database'

export type DailyLog = Database['public']['Tables']['daily_logs']['Row']
export type LogMeal = Database['public']['Tables']['log_meals']['Row']
export type LogEntry = Database['public']['Tables']['log_entries']['Row']

// Subset de `foods` que vem anexado a cada `log_entry` no join. Suficiente
// pra renderizar a row da refeição (nome, badge de fonte, label da porção).
// Não traz macros per-100g — o snapshot em `log_entries` é a fonte de
// verdade pra exibir kcal/proteína/etc da entry.
export interface EntryFoodSummary {
  id: string
  name: string
  brand: string | null
  source: string
  serving_label: string | null
  default_serving_g: number
}

// log_entry + food anexado. Marcamos `food` como nullable por defesa:
// se houver inconsistência de FK (não deveria, há constraint), preferimos
// renderizar "alimento removido" do que crashar.
export interface LogEntryWithFood extends LogEntry {
  food: EntryFoodSummary | null
}

// log_meal + entries em ordem cronológica (created_at asc) dentro da refeição.
export interface LogMealWithEntries extends LogMeal {
  entries: LogEntryWithFood[]
}

// Totais do dia, computados client-side somando `log_entries.{kcal,protein,carbs,fat}`
// de TODAS as refeições. Macros já estão arredondados no banco (numeric).
export interface DayTotals {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

// Payload final retornado pelo `useDailyLog`. Combina:
//   - dailyLog (com snapshots de targets do dia)
//   - meals (ordenadas por sort_order, cada uma com suas entries)
//   - totals (soma agregada)
export interface DailyLogPayload {
  dailyLog: DailyLog
  meals: LogMealWithEntries[]
  totals: DayTotals
}
