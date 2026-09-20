import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PageHeaderProps {
  title: string
  subtitle?: string
  onNew?: () => void
  newLabel?: string
  actions?: React.ReactNode
}

export default function PageHeader({ title, subtitle, onNew, newLabel = 'New', actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {onNew && (
          <Button onClick={onNew} size="sm">
            <Plus size={13} />
            {newLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
