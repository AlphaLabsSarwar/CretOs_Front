import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/shared/Toast'
import PageHeader from '@/components/shared/PageHeader'
import RmcLoader from '@/components/shared/RmcLoader'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Field, inputClass } from '@/components/shared/form-controls'

interface NcrDetail {
  id: string
  ncr_no: string
  source_type: string
  severity: string
  description: string
  root_cause: string | null
  corrective_action: string | null
  preventive_action: string | null
  status: string
  raised_by: string | null
  assigned_to: string | null
  target_close_date: string | null
  approved_by: string | null
  approved_at: string | null
  verified_by: string | null
  verified_at: string | null
  closed_at: string | null
  created_at: string
}

const SEVERITY_TONE: Record<string, BadgeTone> = { MINOR: 'info', MAJOR: 'warning', CRITICAL: 'error' }
const STAGES = ['OPEN', 'ROOT_CAUSE', 'ACTION_PLANNED', 'IMPLEMENTED', 'VERIFIED', 'CLOSED']

export default function NcrDetailPage() {
  const { id } = useParams()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [rootCause, setRootCause] = useState('')
  const [corrective, setCorrective] = useState('')
  const [preventive, setPreventive] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['ncr-detail', id],
    queryFn: () => api.get(`/quality/ncr/${id}`).then(r => r.data.data as NcrDetail),
  })

  const advance = useMutation({
    mutationFn: (body: Record<string, string>) => api.post(`/quality/ncr/${id}/advance`, body),
    onSuccess: () => {
      toast({ title: 'NCR advanced', variant: 'success' })
      qc.invalidateQueries({ queryKey: ['ncr-detail', id] })
      qc.invalidateQueries({ queryKey: ['ncr'] })
    },
    onError: (e: any) => toast({ title: 'Could not advance NCR', description: e?.response?.data?.message, variant: 'error' }),
  })

  if (isLoading || !data) return <RmcLoader size="sm" />

  const stageIndex = STAGES.indexOf(data.status)

  return (
    <div>
      <PageHeader
        title={data.ncr_no}
        subtitle={`Raised by ${data.raised_by ?? '—'} on ${new Date(data.created_at).toLocaleDateString('en-IN')}`}
        actions={<Badge tone={SEVERITY_TONE[data.severity] ?? 'neutral'}>{data.severity}</Badge>}
      />

      <div className="mb-5 flex items-center gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-3">
        {STAGES.map((stage, i) => (
          <div key={stage} className="flex items-center">
            <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${i <= stageIndex ? 'bg-accent/10 text-accent' : 'bg-gray-50 text-gray-300'}`}>
              {i < stageIndex ? <CheckCircle2 size={12} /> : null}
              {stage.replace('_', ' ')}
            </div>
            {i < STAGES.length - 1 && <div className={`h-px w-6 ${i < stageIndex ? 'bg-accent/30' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4">
        <p className="section-label mb-1">Description</p>
        <p className="text-sm text-gray-700">{data.description}</p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-gray-400">
          <span>Source: {data.source_type.replace('_', ' ')}</span>
          {data.assigned_to && <span>Assigned to: {data.assigned_to}</span>}
          {data.target_close_date && <span>Target close: {new Date(data.target_close_date).toLocaleDateString('en-IN')}</span>}
        </div>
      </div>

      {data.root_cause && (
        <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4">
          <p className="section-label mb-1">Root Cause</p>
          <p className="text-sm text-gray-700">{data.root_cause}</p>
        </div>
      )}
      {(data.corrective_action || data.preventive_action) && (
        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="section-label mb-1">Corrective Action</p>
            <p className="text-sm text-gray-700">{data.corrective_action ?? '—'}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="section-label mb-1">Preventive Action</p>
            <p className="text-sm text-gray-700">{data.preventive_action ?? '—'}</p>
            {data.approved_by && <p className="mt-1 text-[10px] text-gray-400">Approved by {data.approved_by}</p>}
          </div>
        </div>
      )}
      {data.verified_by && (
        <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-xs text-green-800">
          Verified by {data.verified_by} on {new Date(data.verified_at!).toLocaleDateString('en-IN')}
          {data.closed_at && <> · Closed {new Date(data.closed_at).toLocaleDateString('en-IN')}</>}
        </div>
      )}

      {data.status === 'OPEN' && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-2 text-xs font-medium text-gray-700">Record Root Cause</p>
          <Field label="Root Cause" required>
            <textarea value={rootCause} onChange={e => setRootCause(e.target.value)} rows={2} className={inputClass(false)} />
          </Field>
          <button
            disabled={!rootCause || advance.isPending}
            onClick={() => advance.mutate({ root_cause: rootCause })}
            className="mt-3 flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {advance.isPending && <Loader2 size={13} className="animate-spin" />} Move to Root Cause
          </button>
        </div>
      )}

      {data.status === 'ROOT_CAUSE' && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-2 text-xs font-medium text-gray-700">Plan Corrective &amp; Preventive Action</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Corrective Action" required>
              <textarea value={corrective} onChange={e => setCorrective(e.target.value)} rows={2} className={inputClass(false)} />
            </Field>
            <Field label="Preventive Action" required>
              <textarea value={preventive} onChange={e => setPreventive(e.target.value)} rows={2} className={inputClass(false)} />
            </Field>
          </div>
          <button
            disabled={!corrective || !preventive || advance.isPending}
            onClick={() => advance.mutate({ corrective_action: corrective, preventive_action: preventive })}
            className="mt-3 flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {advance.isPending && <Loader2 size={13} className="animate-spin" />} Approve Action Plan
          </button>
        </div>
      )}

      {data.status === 'ACTION_PLANNED' && (
        <button
          disabled={advance.isPending}
          onClick={() => advance.mutate({})}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {advance.isPending && <Loader2 size={13} className="animate-spin" />} Mark Actions Implemented
        </button>
      )}

      {data.status === 'IMPLEMENTED' && (
        <button
          disabled={advance.isPending}
          onClick={() => advance.mutate({})}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {advance.isPending && <Loader2 size={13} className="animate-spin" />} Verify Effectiveness
        </button>
      )}

      {data.status === 'VERIFIED' && (
        <button
          disabled={advance.isPending}
          onClick={() => advance.mutate({})}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-green-600 px-4 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {advance.isPending && <Loader2 size={13} className="animate-spin" />} Close NCR
        </button>
      )}

      <p className="mt-4"><Link to="/quality/ncr" className="text-xs text-gray-500 hover:text-gray-800">← Back to NCR list</Link></p>
    </div>
  )
}
