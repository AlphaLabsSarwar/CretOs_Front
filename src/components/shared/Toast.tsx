import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastVariant = 'success' | 'error' | 'info'

interface ToastInput {
  title: string
  description?: string
  variant?: ToastVariant
}

interface ToastItem extends ToastInput {
  id: number
  variant: ToastVariant
}

const ToastContext = createContext<{ toast: (t: ToastInput) => void } | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}

const ICONS: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
}

const STYLES: Record<ToastVariant, string> = {
  success: 'border-green-200 bg-green-50 text-green-800',
  error: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-gray-200 bg-white text-gray-800',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const remove = useCallback((id: number) => {
    setItems(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback(
    (t: ToastInput) => {
      const id = Date.now() + Math.random()
      setItems(prev => [...prev, { id, variant: 'info', ...t }])
      setTimeout(() => remove(id), 4000)
    },
    [remove]
  )

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
        {items.map(item => {
          const Icon = ICONS[item.variant]
          return (
            <div key={item.id} className={cn('flex items-start gap-2 rounded-lg border px-3 py-2.5 shadow-lg', STYLES[item.variant])}>
              <Icon size={16} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium">{item.title}</p>
                {item.description && <p className="mt-0.5 text-xs opacity-80">{item.description}</p>}
              </div>
              <button type="button" onClick={() => remove(item.id)} aria-label="Dismiss notification" className="opacity-60 hover:opacity-100">
                <X size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
