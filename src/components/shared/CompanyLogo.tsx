import { useState } from 'react'
import PrintTruckLogo from './PrintTruckLogo'
import { companyLogoUrl, useCompanyLogoVersion } from '@/lib/companyLogo'

// ─── Company brand mark ──────────────────────────────────────────────────
// Renders the uploaded company logo (set by the company's Admin from the home
// screen — components/branding/CompanyLogoSlot.tsx — or by the Platform Admin >
// Companies > Edit) wherever the app used to
// show the generic CretOS truck mark: the sidebar and all six print
// documents. Falls back to PrintTruckLogo when the company hasn't uploaded
// one yet (companyId missing, or the <img> 404s because logo_path is null —
// the public route returns 404 with no body in that case) so nothing looks
// broken for clients who skip the upload step.
//
// Served from the public, unauthenticated route (routes/public.ts) rather
// than through `api` + a blob fetch — a logo isn't sensitive, and a plain
// <img src> is far simpler than wiring auth-header plumbing into six print
// pages plus the sidebar.
export default function CompanyLogo({ companyId, width = 84, className }: { companyId?: string | null; width?: number; className?: string }) {
  const version = useCompanyLogoVersion(companyId)
  const [failedVersion, setFailedVersion] = useState<string | null>(null)

  if (!companyId || failedVersion === version) return <PrintTruckLogo width={width} />

  return (
    <img
      src={companyLogoUrl(companyId)}
      alt="Company logo"
      width={width}
      style={{ maxWidth: width, maxHeight: width, objectFit: 'contain' }}
      className={className}
      onError={() => setFailedVersion(version)}
    />
  )
}
