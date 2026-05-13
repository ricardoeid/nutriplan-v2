import { CalendarDays, Home, User, Utensils } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

// Bottom navigation com 4 tabs (Hoje / Alimentos / Plano / Perfil),
// match visual da V1. Renderizado pelo AuthGuard pra aparecer em todas
// as rotas autenticadas.
//
// Detecção de tab ativa por prefixo do pathname:
//   '/'            → Hoje (match exato, senão /foods/123 também daria match)
//   '/foods*'      → Alimentos
//   '/plano*'      → Plano (placeholder até Fase 5)
//   '/profile*'    → Perfil
//
// Lucide icons não têm variante filled por default — diferenciamos
// ativa/inativa por cor (primary vs muted-foreground) + strokeWidth
// maior (2.5 vs 2). Suficiente pra destacar sem precisar de variant set.

interface Tab {
  label: string
  to: string
  icon: LucideIcon
  matchPrefix: string
}

const TABS: Tab[] = [
  { label: 'Hoje', to: '/', icon: Home, matchPrefix: '/' },
  { label: 'Alimentos', to: '/foods', icon: Utensils, matchPrefix: '/foods' },
  { label: 'Plano', to: '/plano', icon: CalendarDays, matchPrefix: '/plano' },
  { label: 'Perfil', to: '/profile', icon: User, matchPrefix: '/profile' },
]

function isActive(pathname: string, prefix: string): boolean {
  if (prefix === '/') return pathname === '/'
  return pathname === prefix || pathname.startsWith(prefix + '/')
}

export function BottomNav() {
  const { pathname } = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-background border-t">
      <div className="max-w-md mx-auto grid grid-cols-4">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.matchPrefix)
          const Icon = tab.icon
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={
                'flex flex-col items-center justify-center gap-1 py-2 transition-colors ' +
                (active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground')
              }
              aria-current={active ? 'page' : undefined}
            >
              <Icon
                className="h-5 w-5"
                strokeWidth={active ? 2.5 : 2}
              />
              <span className="text-xs">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
