import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Printer } from 'lucide-react'
import { api } from '@/lib/api'
import CompanyLogo from '@/components/shared/CompanyLogo'

interface QualityTestPrintData {
  id: string
  challan_id: string | null
  grade_name: string | null
  cast_date: string
  test_date: string | null
  age_days: number
  cube_id: string | null
  target_strength: string | number | null
  actual_strength: string | number | null
  result: 'PENDING' | 'PASS' | 'FAIL'
  remarks: string | null
  customer_name: string | null
  challan_no: string | null
  job_site: string | null
  branch_name: string | null
  branch_address: string | null
  branch_city: string | null
  branch_state: string | null
  branch_pin_code: string | null
  branch_phone: string | null
  branch_email: string | null
  branch_company_id: string | null
}

function fmtDate(v: string | null) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Numbered field row, matching the "1 / 2 / 3..." field-table convention a
// lab test report uses — see the row component below.
function FieldRow({ n, label, value }: { n: number; label: string; value: string }) {
  return (
    <tr className="border-b border-gray-300">
      <td className="w-8 px-2 py-1.5 text-center text-gray-500">{n}</td>
      <td className="w-1/3 px-2 py-1.5 font-semibold text-gray-600">{label}</td>
      <td className="px-2 py-1.5">{value}</td>
    </tr>
  )
}

const RESULT_STYLE: Record<string, string> = {
  PASS: 'bg-green-100 text-green-700 border-green-300',
  FAIL: 'bg-red-100 text-red-700 border-red-300',
  PENDING: 'bg-amber-100 text-amber-700 border-amber-300',
}

export default function QualityTestPrintPage() {
  const { id } = useParams()

  const { data: test, isLoading } = useQuery({
    queryKey: ['quality-test-print', id],
    queryFn: () => api.get(`/quality/${id}`).then(r => r.data.data as QualityTestPrintData),
    enabled: !!id,
  })

  useEffect(() => {
    document.title = test ? `Cube Test ${test.cube_id ?? test.id.slice(0, 8)}` : 'Cube Test Report'
  }, [test])

  if (isLoading || !test) {
    return (
      <div className="flex min-h-screen items-center justify-center text-xs text-gray-400">
        <Loader2 size={14} className="mr-2 animate-spin" /> Loading test report...
      </div>
    )
  }

  const target = test.target_strength != null ? Number(test.target_strength) : null
  const actual = test.actual_strength != null ? Number(test.actual_strength) : null
  const pctStrength = target && actual ? Math.round((actual / target) * 1000) / 10 : null

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-3xl items-center justify-between px-4">
        <Link to={`/quality/tests/${id}/edit`} className="text-xs text-gray-500 hover:text-gray-800">← Back to Test Record</Link>
        <button
          onClick={() => window.print()}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white hover:bg-accent-hover"
        >
          <Printer size={13} /> Print / Save as PDF
        </button>
      </div>

      {/* Internal plant record — deliberately no NABL/ISO-17025 accreditation
          marks or wording. CretOS is the RMC plant's own ERP, not an
          accredited external testing lab; if a cube was actually tested by
          an outside NABL lab, that lab's own certificate (attached
          separately, e.g. as a scanned upload) remains the authoritative
          document — this is the plant's own QA record of the result. */}
      <div className="mx-auto max-w-3xl border-2 border-gray-800 bg-white p-5 text-[11px] text-gray-800 shadow-sm print:max-w-none print:border print:shadow-none">
        <div className="mb-3 flex justify-center">
          <div className="border-2 border-gray-800 px-6 py-1 text-sm font-bold tracking-wide">CUBE TEST REPORT</div>
        </div>

        <div className="flex items-start justify-between border-b-2 border-gray-800 pb-2">
          <div>
            <h1 className="text-base font-bold uppercase text-gray-900">{test.branch_name ?? 'CretOS RMC Plant'}</h1>
            <p className="mt-0.5 text-gray-600">
              {[test.branch_address, test.branch_city, test.branch_state].filter(Boolean).join(', ')}
              {test.branch_pin_code ? `- ${test.branch_pin_code}` : ''}
            </p>
            {(test.branch_phone || test.branch_email) && (
              <p className="text-gray-600">{[test.branch_phone, test.branch_email].filter(Boolean).join(' · ')}</p>
            )}
            <p className="mt-0.5 text-[10px] text-gray-400">Internal quality-control record — plant laboratory</p>
          </div>
          <CompanyLogo companyId={test.branch_company_id} width={72} />
        </div>

        {/* Numbered field table — same spirit as a lab report's field list */}
        <table className="mt-2 w-full border-collapse text-[11px]">
          <tbody>
            <FieldRow n={1} label="Name of Client" value={test.customer_name ?? '—'} />
            <FieldRow n={2} label="Name of Work / Site" value={test.job_site ?? '—'} />
            <FieldRow n={3} label="Related Challan No" value={test.challan_no ?? '—'} />
            <FieldRow n={4} label="Concrete Grade" value={test.grade_name ?? '—'} />
            <FieldRow n={5} label="Sample / Cube ID" value={test.cube_id ?? '—'} />
            <FieldRow n={6} label="Date of Casting" value={fmtDate(test.cast_date)} />
            <FieldRow n={7} label="Date of Testing" value={fmtDate(test.test_date)} />
            <FieldRow n={8} label="Age at Test" value={`${test.age_days} Days`} />
            <FieldRow n={9} label="Test Method" value="IS 516" />
          </tbody>
        </table>

        {/* Result */}
        <div className="mt-2 border-t-2 border-gray-800 pt-2">
          <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-600">Result for Concrete Cube Sample</p>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-y border-gray-800 text-left">
                <th className="px-2 py-1 font-semibold text-gray-600">Target Strength</th>
                <th className="px-2 py-1 font-semibold text-gray-600">Actual Strength</th>
                <th className="px-2 py-1 font-semibold text-gray-600">% of Target</th>
                <th className="px-2 py-1 text-right font-semibold text-gray-600">Result</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-2 py-1.5 font-mono">{target != null ? `${target.toFixed(2)} N/mm²` : '—'}</td>
                <td className="px-2 py-1.5 font-mono">{actual != null ? `${actual.toFixed(2)} N/mm²` : '—'}</td>
                <td className="px-2 py-1.5 font-mono">{pctStrength != null ? `${pctStrength}%` : '—'}</td>
                <td className="px-2 py-1.5 text-right">
                  <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${RESULT_STYLE[test.result]}`}>
                    {test.result}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {test.remarks && (
          <div className="mt-2 border-t border-gray-300 py-1 text-[10px]">
            <span className="font-semibold text-gray-600">Remarks : </span>{test.remarks}
          </div>
        )}

        <div className="mt-10 grid grid-cols-3 gap-6 text-[10px]">
          <div className="border-t border-gray-400 pt-1 text-center text-gray-500">Tested By</div>
          <div className="border-t border-gray-400 pt-1 text-center text-gray-500">QA In-charge</div>
          <div className="border-t border-gray-400 pt-1 text-center text-gray-500">Authorised Signatory</div>
        </div>

        <p className="mt-3 text-center text-[10px] text-gray-400">
          This is an internal quality-control record generated by {test.branch_name ?? 'the plant'} — not an accredited third-party certificate.
        </p>
      </div>
    </div>
  )
}
