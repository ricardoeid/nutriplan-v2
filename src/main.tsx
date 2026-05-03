import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

import { AuthProvider } from '@/features/auth/context/auth-context'
import App from './App.tsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min — cache "fresco" sem refetch
      gcTime: 1000 * 60 * 30,   // 30 min — quanto tempo cache fica em memória depois de não-usado
      retry: 1,                  // tenta 1x extra em erro de rede; mais que isso atrapalha em offline
      refetchOnWindowFocus: false, // refetch ao trocar de aba é agressivo demais; desligamos por padrão
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
)
