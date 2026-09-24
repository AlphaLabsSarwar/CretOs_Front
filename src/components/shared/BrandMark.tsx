import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authStore } from '@/store/auth'
import { cn } from '@/lib/utils'
import { companyLogoUrl, useCompanyLogoVersion } from '@/lib/companyLogo'

// The company's own logo next to the CretOS wordmark, linking back to the
// workspace launcher. Falls back to the generic "C" mark until the logo loads
// (or forever, if this company never uploaded one / the request 404s) — see
// Platform Admin > Companies > Edit for the upload UI and
// components/shared/CompanyLogo.tsx for the same fallback on print pages.
export default function BrandMark({ tone = 'dark', size = 'md', onClick }: { tone?: 'dark' | 'light'; size?: 'md' | 'lg'; onClick?: () => void }) {
  const user = authStore.getUser()
  const companyId = user?.company?.id
  // A 404 only means "no logo *yet*": remember which version failed so a fresh upload is retried.
  const version = useCompanyLogoVersion(companyId)
  const [failedVersion, setFailedVersion] = useState<string | null>(null)
  const logoFailed = failedVersion === version

  return (
    <Link to="/home" onClick={onClick} title="All workspaces" className="flex items-center gap-2">
      {companyId && !logoFailed ? (
        <img
          src={companyLogoUrl(companyId)}
          alt={user?.company?.name ?? 'Company logo'}
          className={cn('rounded-lg object-contain', size === 'lg' ? 'h-[34px] w-[34px] rounded-[10px]' : 'h-7 w-7', tone === 'dark' && 'bg-white/10')}
          onError={() => setFailedVersion(version)}
        />
      ) : (
        <div className={cn('bg-accent rounded-lg flex items-center justify-center', size === 'lg' ? 'h-[34px] w-[34px] rounded-[10px]' : 'h-7 w-7')}>
          <span className={cn('text-white font-bold', size === 'lg' ? 'text-base' : 'text-xs')}>C</span>
        </div>
      )}
      <span className={cn('font-bold tracking-tight', size === 'lg' ? 'text-xl font-extrabold tracking-[-0.01em] sm:text-[21px]' : 'text-base', tone === 'dark' ? 'text-white' : 'text-gray-900 dark:text-white')}>CretOS</span>
    </Link>
  )
}
