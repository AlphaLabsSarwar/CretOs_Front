// Recipe Store & Mix Combinations — SAMPLE DATA.
//
// The product design adds a recipe module (library, recipe detail, trial-mix
// wizard) that has no backend yet. Until the API exists these screens read
// from this file, and every screen shows a "Sample data" badge so nobody
// mistakes it for live plant data. Swap RECIPES / getRecipe for react-query
// calls once a recipe API exists; the shapes below are what the screens expect.

export type RecipeStatus = 'Approved' | 'Under Review' | 'Trial' | 'Draft' | 'Rejected' | 'Archived'

export interface RecipeSummary {
  id: string
  name: string
  grade: string
  customer: string | null
  project: string | null
  plant: string
  mixType: string
  version: number
  status: RecipeStatus
  updatedOn: string
  updatedBy: string
}

export interface MaterialLine {
  material: string
  supplier: string
  unit: 'kg' | 'L'
  target: number | null
  tolerance: number | null
  actual: number | null
  cost: number | null
  note: string
  noteTone: 'ok' | 'warn' | 'bad' | 'muted'
  highlight?: 'warn'
}

export interface RecipeDetail extends RecipeSummary {
  description: string
  specs: { label: string; value: string; tone?: 'ok' }[]
  usage: { ordersThisMonth: number; avgStrength: number; costPerCum: number }
  materials: MaterialLine[]
  totals: { label: string; value: string; tone?: 'warn' }[]
  trials: { sample: string; cast: string; slump: string; d7: number; d28: number | null; result: 'Passed' | 'Failed' | 'Pending' }[]
  batches: { batch: string; date: string; plant: string; planned: number; actual: number; deviation: string; ok: boolean }[]
  documents: { name: string; kind: 'doc' | 'image'; date: string }[]
  versions: { version: number; date: string; by: string; note: string }[]
  approvals: { step: string; by: string | null; date: string | null }[]
  composition: { label: string; pct: number; color: string }[]
  alert: string | null
}

export const RECIPES: RecipeSummary[] = [
  { id: 'M30-RMC-014', name: 'M30 Pump Mix', grade: 'M30', customer: 'Shree Constructions', project: 'Whitefield Site 2', plant: 'Whitefield Plant', mixType: 'Pumpable', version: 3, status: 'Approved', updatedOn: '18 Sep', updatedBy: 'R. Iyer' },
  { id: 'M25-RMC-009', name: 'M25 Standard', grade: 'M25', customer: 'Nandi Infra', project: 'Sarjapur Yard', plant: 'Whitefield Plant', mixType: 'Standard', version: 2, status: 'Approved', updatedOn: '12 Sep', updatedBy: 'R. Iyer' },
  { id: 'M40-RMC-002', name: 'M40 High-Strength', grade: 'M40', customer: 'Metro Builders', project: 'Hebbal Site', plant: 'Sarjapur Plant', mixType: 'High-Strength', version: 1, status: 'Under Review', updatedOn: '20 Sep', updatedBy: 'S. Rao' },
  { id: 'SCC-RMC-005', name: 'Self-Compacting Mix', grade: 'M35', customer: null, project: 'Internal trial', plant: 'Whitefield Plant', mixType: 'SCC', version: 1, status: 'Trial', updatedOn: '19 Sep', updatedBy: 'Lab Team' },
  { id: 'M20-RMC-021', name: 'M20 Waterproof', grade: 'M20', customer: 'Vantage Realty', project: 'HSR Layout', plant: 'Whitefield Plant', mixType: 'Waterproof', version: 4, status: 'Draft', updatedOn: '15 Sep', updatedBy: 'R. Iyer' },
  { id: 'M30-RMC-011', name: 'M30 Cost-Optimized', grade: 'M30', customer: 'Orion Devs', project: 'Marathahalli', plant: 'Sarjapur Plant', mixType: 'Customer-Specific', version: 2, status: 'Rejected', updatedOn: '10 Sep', updatedBy: 'S. Rao' },
  { id: 'M25-RMC-003', name: 'M25 Legacy Mix', grade: 'M25', customer: null, project: null, plant: 'Whitefield Plant', mixType: 'Standard', version: 1, status: 'Archived', updatedOn: '02 Aug', updatedBy: 'R. Iyer' },
]

/** Library headline counts (the design's KPI strip). */
export const RECIPE_STATS = {
  approved: 42,
  inTrial: 6,
  pendingApproval: 3,
  usedToday: 11,
  reviewDue: 4,
}

const M30_PUMP: RecipeDetail = {
  ...RECIPES[0],
  description: 'A pumpable M30 mix developed for Shree Constructions’ Whitefield Site 2 tower pours. Uses 20% GGBS replacement for durability and a polycarboxylate plasticizer to hold slump through a 90-minute delivery window. Approved after 3 successful cube-test cycles.',
  specs: [
    { label: 'Target Strength', value: '30 MPa' },
    { label: 'Slump Range', value: '100–120mm' },
    { label: 'Workability', value: 'S3' },
    { label: 'Max Aggregate', value: '20mm' },
    { label: 'Pumping', value: 'Required', tone: 'ok' },
    { label: 'Exposure Class', value: 'XC2' },
    { label: 'Delivery Target', value: '90 min' },
  ],
  usage: { ordersThisMonth: 14, avgStrength: 32.4, costPerCum: 4860 },
  materials: [
    { material: 'Cement (OPC 53)', supplier: 'UltraTech', unit: 'kg', target: 300, tolerance: 5, actual: 298, cost: 1410, note: 'In stock', noteTone: 'ok' },
    { material: 'Fly Ash / GGBS', supplier: 'JSW Cement', unit: 'kg', target: 75, tolerance: 3, actual: 75, cost: 285, note: 'Substituted with GGBS', noteTone: 'warn', highlight: 'warn' },
    { material: 'Fine Aggregate / M-Sand', supplier: 'Local Quarry Co.', unit: 'kg', target: 720, tolerance: 15, actual: 725, cost: 576, note: 'In stock', noteTone: 'ok' },
    { material: 'Coarse Aggregate 10mm', supplier: 'Blue Metal Suppliers', unit: 'kg', target: 380, tolerance: 10, actual: 376, cost: 266, note: 'In stock', noteTone: 'ok' },
    { material: 'Coarse Aggregate 20mm', supplier: 'Blue Metal Suppliers', unit: 'kg', target: 640, tolerance: 10, actual: 638, cost: 448, note: 'Low stock · 2 days left', noteTone: 'bad' },
    { material: 'Water', supplier: 'Bore well · tested', unit: 'L', target: 150, tolerance: 3, actual: 149, cost: null, note: 'Available', noteTone: 'ok' },
    { material: 'Admixture / Plasticizer', supplier: 'Sika ViscoCrete', unit: 'L', target: 3.75, tolerance: 0.2, actual: 3.8, cost: 338, note: 'In stock', noteTone: 'ok' },
    { material: 'Fibres / Special Additive', supplier: '—', unit: 'kg', target: null, tolerance: null, actual: null, cost: null, note: 'n/a for this grade', noteTone: 'muted' },
  ],
  totals: [
    { label: 'Total binder', value: '375 kg' },
    { label: 'W/C ratio', value: '0.40' },
    { label: 'Cost / m³', value: '₹4,860' },
    { label: 'Est. yield', value: '1.00 m³' },
    { label: 'Target strength', value: '30 MPa' },
    { label: 'Slump target', value: '110mm' },
    { label: 'Availability', value: 'Check 20mm', tone: 'warn' },
  ],
  trials: [
    { sample: 'CB-1188', cast: '10 Sep', slump: '112mm', d7: 21.4, d28: 32.1, result: 'Passed' },
    { sample: 'CB-1201', cast: '12 Sep', slump: '108mm', d7: 20.8, d28: 31.6, result: 'Passed' },
    { sample: 'CB-1240', cast: '18 Sep', slump: '115mm', d7: 21.0, d28: null, result: 'Pending' },
  ],
  batches: [
    { batch: '#4482', date: '21 Sep', plant: 'Whitefield', planned: 8, actual: 7.9, deviation: 'Within tolerance', ok: true },
    { batch: '#4470', date: '14 Sep', plant: 'Whitefield', planned: 6, actual: 6.4, deviation: 'Water +8% over plan', ok: false },
    { batch: '#4455', date: '08 Sep', plant: 'Whitefield', planned: 10, actual: 10, deviation: 'Within tolerance', ok: true },
  ],
  documents: [
    { name: 'Lab approval certificate.pdf', kind: 'doc', date: '18 Sep' },
    { name: 'Cube test photos (6).zip', kind: 'image', date: '18 Sep' },
    { name: 'Mix design worksheet v3.xlsx', kind: 'doc', date: '17 Sep' },
  ],
  versions: [
    { version: 3, date: '18 Sep', by: 'R. Iyer', note: 'Reduced water 5 L, added GGBS substitution for durability.' },
    { version: 2, date: '02 Aug', by: 'S. Rao', note: 'Increased plasticizer dosage to hold slump past 60 minutes.' },
    { version: 1, date: '14 Jun', by: 'R. Iyer', note: 'Initial approved mix design for Shree Constructions.' },
  ],
  approvals: [
    { step: 'Created', by: 'R. Iyer', date: '14 Jun' },
    { step: 'Lab checked', by: 'S. Rao', date: '17 Sep' },
    { step: 'Plant approved', by: 'V. Kumar', date: '18 Sep' },
    { step: 'Released to production', by: null, date: null },
  ],
  composition: [
    { label: 'Cement', pct: 15, color: '#E8630A' },
    { label: 'Fly Ash/GGBS', pct: 5, color: '#F3AA79' },
    { label: 'Coarse Aggregate', pct: 28, color: '#2563EB' },
    { label: 'Fine Aggregate', pct: 40, color: '#93C5FD' },
    { label: 'Water', pct: 7, color: '#94A3B8' },
    { label: 'Admixture', pct: 1, color: '#16A34A' },
  ],
  alert: 'Fly Ash substituted with GGBS this cycle, and Coarse Aggregate 20mm is low on stock — verify tolerance before releasing the next batch.',
}

/** Sample detail for any recipe: the fully worked M30 example, re-labelled. */
export function getRecipe(id: string): RecipeDetail | null {
  const summary = RECIPES.find(r => r.id === id)
  if (!summary) return null
  if (summary.id === M30_PUMP.id) return M30_PUMP
  return {
    ...M30_PUMP,
    ...summary,
    description: `${summary.name} — ${summary.mixType.toLowerCase()} mix for ${summary.project ?? 'internal use'}.`,
    specs: M30_PUMP.specs.map(s => (s.label === 'Target Strength' ? { ...s, value: `${summary.grade.replace(/\D/g, '')} MPa` } : s)),
    versions: M30_PUMP.versions.filter(v => v.version <= summary.version),
  }
}

export const STATUS_STYLE: Record<RecipeStatus, string> = {
  Approved: 'bg-green-50 text-green-600',
  'Under Review': 'bg-white text-amber-600',
  Trial: 'bg-accent-light text-accent-hover',
  Draft: 'bg-slate-100 text-gray-500',
  Rejected: 'bg-white text-red-600',
  Archived: 'bg-slate-100 text-gray-500',
}

/** Row tint in the library table: under-review rows amber, rejected rows red. */
export const ROW_TINT: Partial<Record<RecipeStatus, string>> = {
  'Under Review': 'bg-amber-50',
  Rejected: 'bg-red-50',
}
