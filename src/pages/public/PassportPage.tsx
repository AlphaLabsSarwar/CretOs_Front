import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Award, Beaker, CheckCircle2, Loader2, Scale, ScanLine, XCircle } from 'lucide-react'

interface PassportChallan {
  challan_no: string; date: string; job_site: string; grade_name: string | null
  qty: string | number; act_qty: string | number | null; slump: string | number | null; status: string
  dispatch_time: string; site_in: string | null; site_out: string | null
  customer_name: string | null; vehicle_no: string | null; driver_name: string | null
}
interface PassportPlant {
  branch_name: string | null; branch_phone: string | null; branch_city: string | null; branch_gstin: string | null
  company_name: string | null; company_gstin: string | null; logo_url: string | null
}
interface PassportGrade {
  grade_name: string; grade_code: string | null; version: number
  cement_qty: number; flyash_qty: number | null; ggbs_qty: number | null
  mm20_qty: number; mm10_qty: number | null; mm40_qty: number | null
  csand_qty: number | null; fsand_qty: number | null; water_qty: number | null; admix_qty: number | null
  water_ratio: number | null; cement_grade: string | null; admix_type: string | null; admix_name: string | null; msa: string | null
}
interface PassportBatchMaterial { material_key: string; uom: string; target_qty: number; actual_qty: number | null; variance_qty: number | null }
interface PassportBatch {
  batch_no: string; batch_qty_cum: number; status: string; source: string
  started_at: string | null; completed_at: string | null
  moisture_correction_pct: number | null; water_added_extra_l: number | null
  materials: PassportBatchMaterial[]
}
interface PassportWeighbridge { ticket_no: string; ticket_type: string; gross_weight: number | null; gross_time: string | null; tare_weight: number | null; tare_time: string | null; net_weight: number | null }
interface PassportQualityTest { cube_id: string | null; cast_date: string; test_date: string | null; age_days: number; target_strength: number | null; actual_strength: number | null; result: string }
interface PassportData {
  challan: PassportChallan; plant: PassportPlant; grade: PassportGrade | null
  batch: PassportBatch | null; weighbridge: PassportWeighbridge[]; qualityTests: PassportQualityTest[]
}

const MATERIAL_LABELS: Record<string, string> = {
  CEMENT: 'Cement', FLYASH: 'Fly Ash', GGBS: 'GGBS', MM20: '20mm Aggregate', MM10: '10mm Aggregate', MM40: '40mm Aggregate',
  CSAND: 'Crushed Sand', FSAND: 'Natural Sand', WATER: 'Water', ADMIX: 'Admixture',
}
const RECIPE_FIELDS: { key: keyof PassportGrade; label: string }[] = [
  { key: 'cement_qty', label: 'Cement' }, { key: 'flyash_qty', label: 'Fly Ash' }, { key: 'ggbs_qty', label: 'GGBS' },
  { key: 'mm20_qty', label: '20mm Aggregate' }, { key: 'mm10_qty', label: '10mm Aggregate' }, { key: 'mm40_qty', label: '40mm Aggregate' },
  { key: 'csand_qty', label: 'Crushed Sand' }, { key: 'fsand_qty', label: 'Natural Sand' }, { key: 'water_qty', label: 'Water' }, { key: 'admix_qty', label: 'Admixture' },
]

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className={`text-gray-800 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}

function fmtDateTime(v: string | null) {
  if (!v) return '—'
  return new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function PassportPage() {
  const { code } = useParams()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['passport', code],
    queryFn: () => axios.get(`/api/v1/public/passport/${code}`).then(r => r.data.data as PassportData),
    enabled: !!code,
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-400">
        <Loader2 size={16} className="mr-2 animate-spin" /> Loading batch passport...
      </div>
    )
  }
  if (isError || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-gray-50 px-6 text-center">
        <XCircle size={32} className="text-gray-300" />
        <p className="text-sm font-medium text-gray-700">Passport link not found</p>
        <p className="text-xs text-gray-400">Double-check the link, or contact the plant for help.</p>
      </div>
    )
  }

  const { challan, plant, grade, batch, weighbridge, qualityTests } = data

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 print:bg-white print:py-0">
      <div className="mx-auto max-w-2xl">
        <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-accent">
              <ScanLine size={12} /> Digital Batch Passport
            </p>
            <h1 className="mt-1 text-lg font-bold text-gray-900">{plant.company_name ?? plant.branch_name ?? 'RMC Plant'}</h1>
            <p className="text-xs text-gray-500">{plant.branch_name}{plant.branch_city ? `, ${plant.branch_city}` : ''}</p>
            {plant.company_gstin && <p className="mt-0.5 font-mono text-[10px] text-gray-400">GSTIN: {plant.company_gstin}</p>}
          </div>
          {plant.logo_url && <img src={plant.logo_url} alt="" className="h-12 w-12 rounded-lg object-contain" />}
        </div>

        <div className="mb-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="section-label mb-2">Delivery Record</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
            <Field label="Challan No" value={challan.challan_no} mono />
            <Field label="Date" value={new Date(challan.date).toLocaleDateString('en-IN')} />
            <Field label="Status" value={challan.status} />
            <Field label="Grade" value={challan.grade_name ?? '—'} />
            <Field label="Ordered Qty" value={`${challan.qty} m³`} />
            <Field label="Actual Qty" value={challan.act_qty != null ? `${challan.act_qty} m³` : '—'} />
            <Field label="Slump" value={challan.slump != null ? `${challan.slump} mm` : '—'} />
            <Field label="Job Site" value={challan.job_site} />
            <Field label="Customer" value={challan.customer_name ?? '—'} />
            <Field label="Vehicle" value={challan.vehicle_no ?? '—'} mono />
            <Field label="Driver" value={challan.driver_name ?? '—'} />
            <Field label="Dispatched" value={fmtDateTime(challan.dispatch_time)} />
          </div>
        </div>

        {grade && (
          <div className="mb-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
              <Beaker size={13} className="text-accent" /> Mix Design — {grade.grade_name} (v{grade.version})
            </p>
            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
              {grade.cement_grade && <span>Cement: {grade.cement_grade}</span>}
              {grade.water_ratio != null && <span>W/C Ratio: {grade.water_ratio}</span>}
              {grade.msa && <span>MSA: {grade.msa}</span>}
              {grade.admix_name && <span>Admix: {grade.admix_name}{grade.admix_type ? ` (${grade.admix_type})` : ''}</span>}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {RECIPE_FIELDS.filter(f => grade[f.key] != null && Number(grade[f.key]) > 0).map(f => (
                <div key={f.key as string} className="rounded-lg bg-gray-50 px-2.5 py-1.5 text-[11px]">
                  <p className="text-gray-400">{f.label}</p>
                  <p className="font-mono font-medium text-gray-800">{Number(grade[f.key])} kg/m³</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {batch && (
          <div className="mb-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
              <Scale size={13} className="text-accent" /> Actual Batching — {batch.batch_no}
            </p>
            <p className="mb-3 text-[11px] text-gray-400">
              {batch.batch_qty_cum} m³ · {batch.source === 'PLC' ? 'plant-automated' : 'manually entered'} · completed {fmtDateTime(batch.completed_at)}
            </p>
            {batch.materials.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-400">
                      <th className="py-1 font-medium">Material</th>
                      <th className="py-1 text-right font-medium">Target</th>
                      <th className="py-1 text-right font-medium">Actual</th>
                      <th className="py-1 text-right font-medium">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.materials.map(m => (
                      <tr key={m.material_key} className="border-b border-gray-100 last:border-0">
                        <td className="py-1 text-gray-700">{MATERIAL_LABELS[m.material_key] ?? m.material_key}</td>
                        <td className="py-1 text-right font-mono text-gray-500">{m.target_qty} {m.uom}</td>
                        <td className="py-1 text-right font-mono text-gray-800">{m.actual_qty ?? '—'}</td>
                        <td className={`py-1 text-right font-mono ${m.variance_qty && Math.abs(m.variance_qty) > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                          {m.variance_qty != null ? m.variance_qty : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {weighbridge.length > 0 && (
          <div className="mb-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="mb-2 text-xs font-semibold text-gray-700">Weighbridge Tickets</p>
            <div className="space-y-2">
              {weighbridge.map(t => (
                <div key={t.ticket_no} className="flex flex-wrap items-center gap-x-4 gap-y-0.5 rounded-lg bg-gray-50 px-3 py-2 text-[11px]">
                  <span className="font-mono font-medium text-gray-700">{t.ticket_no}</span>
                  <span className="text-gray-400">{t.ticket_type}</span>
                  <span className="text-gray-500">Gross: {t.gross_weight ?? '—'} kg</span>
                  <span className="text-gray-500">Tare: {t.tare_weight ?? '—'} kg</span>
                  <span className="font-medium text-gray-800">Net: {t.net_weight ?? '—'} kg</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {qualityTests.length > 0 && (
          <div className="mb-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
              <Award size={13} className="text-accent" /> Cube Test Results
            </p>
            <div className="space-y-1.5">
              {qualityTests.map((t, i) => (
                <div key={i} className="flex items-center gap-3 text-[11px]">
                  {t.result === 'PASS' ? <CheckCircle2 size={13} className="shrink-0 text-green-600" /> : t.result === 'FAIL' ? <XCircle size={13} className="shrink-0 text-red-500" /> : <span className="h-3 w-3 shrink-0 rounded-full bg-gray-200" />}
                  <span className="text-gray-600">{t.age_days}-day{t.cube_id ? ` · ${t.cube_id}` : ''}</span>
                  <span className="text-gray-400">Target {t.target_strength ?? '—'} MPa</span>
                  <span className="font-medium text-gray-800">Actual {t.actual_strength ?? 'pending'} {t.actual_strength != null ? 'MPa' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-[10px] text-gray-400">This is a permanent digital record of this concrete delivery.</p>
      </div>
    </div>
  )
}
