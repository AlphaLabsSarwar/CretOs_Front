import { useState } from 'react'
import PrintTruckLogo from './PrintTruckLogo'

// ─── Company brand mark ──────────────────────────────────────────────────
// Renders the uploaded company logo (see Platform Admin > Companies > Edit,
// routes/platform/companies.ts's POST /:id/logo) wherever the app used to
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
  const [failed, setFailed] = useState(false)

  if (!companyId || failed) return <PrintTruckLogo width={width} />

  return (
    <img
      src={`/api/v1/public/companies/${companyId}/logo`}
      alt="Company logo"
      width={width}
      style={{ maxWidth: width, maxHeight: width, objectFit: 'contain' }}
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
