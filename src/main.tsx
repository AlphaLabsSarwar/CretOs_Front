// Must stay the first import — installs the offline axios adapter before any
// API client is created. See lib/offline.ts.
import { OFFLINE } from './lib/offline'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { ToastProvider } from './components/shared/Toast'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: OFFLINE ? false : 1, staleTime: 30_000 },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
