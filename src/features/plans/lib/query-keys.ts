// Query keys da feature `plans`. Padrão segue `foodKeys`/`logKeys` —
// invalidação ampla via `planKeys.all`, granular via subseções.
//
//   queryClient.invalidateQueries({ queryKey: planKeys.all })
//     → derruba lista + detail + tree de todos os planos
//
//   queryClient.invalidateQueries({ queryKey: planKeys.list() })
//     → derruba só a lista (use após activate/delete/create)
//
//   queryClient.invalidateQueries({ queryKey: planKeys.tree(id) })
//     → derruba o tree de um plano específico (use após save no B5)
//
// `detail` e `tree` são placeholders pros blocos B3-B6; B1 só usa `list`.
export const planKeys = {
  all: ['plans'] as const,
  list: () => ['plans', 'list'] as const,
  detail: (id: string | undefined) => ['plans', 'detail', id] as const,
  tree: (id: string | undefined) => ['plans', 'tree', id] as const,
}
