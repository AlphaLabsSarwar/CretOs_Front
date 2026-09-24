// ─── Offline API: request router ─────────────────────────────────────────
// Answers every endpoint the UI calls from the demo dataset in ./data.ts.
// Lists page / search / filter like the real API ({ data, total, page, limit });
// reports and dashboards are computed from the same records so the numbers
// agree across screens. Writes (create / update / deactivate / delete) change
// the in-memory records, so a saved form shows up in its list until reload.
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as D from './data'

export interface MockRequest { method: string; path: string; query: Record<string, any>; body: any }
type Handler = (req: MockRequest, params: Record<string, string>) => unknown

const todayIso = () => D.dateOnly(new Date().toISOString())
const num = (v: unknown) => (v == null || v === '' ? 0 : Number(v))
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d
const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)

// ─── Generic list / CRUD ─────────────────────────────────────────────────
function paginate(rows: any[], q: Record<string, any>) {
  const page = Math.max(1, Number(q.page ?? 1))
  const limit = Math.max(1, Number(q.limit ?? 25))
  return { data: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, limit }
}

const FILTER_KEYS = ['status', 'result', 'customer_id', 'vendor_id', 'vehicle_id', 'driver_type', 'sync_status', 'ticket_type', 'entity_type', 'action', 'severity']

function list(rows: any[], q: Record<string, any>, searchFields: string[] = []) {
  let out = rows
  for (const key of FILTER_KEYS) if (q[key] != null && q[key] !== '') out = out.filter(r => String(r[key]) === String(q[key]))
  if (q.is_active === true || q.is_active === 'true') out = out.filter(r => r.is_active !== false)
  const s = String(q.search ?? '').trim().toLowerCase()
  if (s) out = out.filter(r => searchFields.some(f => String(r[f] ?? '').toLowerCase().includes(s)))
  return paginate(out, q)
}

let numberSeq = 9000
function crud(base: string, rows: any[], opts: { search?: string[]; numberField?: string; prefix?: string; softDelete?: boolean; defaults?: (b: any) => any } = {}) {
  const find = (id: string) => rows.find(r => r.id === id)
  const routes: [string, string, Handler][] = [
    ['GET', base, req => list(rows, req.query, opts.search)],
    ['GET', `${base}/:id`, (_r, p) => find(p.id) ?? notFound()],
    ['POST', base, req => {
      const rec = {
        id: D.newId(base.split('/').pop()!), status: 'DRAFT', is_active: true, created_at: new Date().toISOString(),
        ...(opts.numberField ? { [opts.numberField]: `${opts.prefix}-${++numberSeq}` } : {}),
        ...(opts.defaults?.(req.body) ?? {}), ...req.body,
      }
      rows.unshift(rec)
      return rec
    }],
    ['PUT', `${base}/:id`, (req, p) => Object.assign(find(p.id) ?? notFound(), req.body)],
    ['PATCH', `${base}/:id`, (req, p) => Object.assign(find(p.id) ?? notFound(), req.body)],
    ['DELETE', `${base}/:id`, (_r, p) => {
      const rec = find(p.id) ?? notFound()
      if (opts.softDelete !== false && 'is_active' in rec) rec.is_active = false
      else rows.splice(rows.indexOf(rec), 1)
      return { id: p.id }
    }],
  ]
  return routes
}

class NotFound extends Error {}
function notFound(): never { throw new NotFound('Not found') }
export const isNotFound = (e: unknown) => e instanceof NotFound

// ─── Derived figures ─────────────────────────────────────────────────────
const deliveredOn = (day: string) => D.CHALLANS.filter(c => c.date === day && c.status !== 'DRAFT')
const outstandingFor = (customerId: string) =>
  D.INVOICES.filter(i => i.customer_id === customerId && i.status === 'POSTED').reduce((s, i) => s + i.total_amount, 0)
  - D.RECEIPTS.filter(r => r.customer_id === customerId && r.status === 'POSTED').reduce((s, r) => s + r.pay_amount, 0) * 0.35

function agingSide(entries: { partyId: string; partyName: string; ref: string; date: string; amount: number }[]) {
  const bucket = (d: number) => (d <= 30 ? '0-30' : d <= 60 ? '31-60' : '60+')
  const byParty = new Map<string, any>()
  const buckets: Record<string, number> = { '0-30': 0, '31-60': 0, '60+': 0 }
  for (const e of entries) {
    const days = daysSince(e.date)
    const row = byParty.get(e.partyId) ?? { partyId: e.partyId, partyName: e.partyName, entries: [], total: 0 }
    row.entries.push({ ref: e.ref, date: e.date, amount: e.amount, days, bucket: bucket(days) })
    row.total += e.amount
    buckets[bucket(days)] += e.amount
    byParty.set(e.partyId, row)
  }
  const rows = [...byParty.values()].sort((a, b) => b.total - a.total)
  return { rows, summary: { buckets, total: rows.reduce((s, r) => s + r.total, 0) } }
}
function aging() {
  // Older invoices are pushed back in time so all three buckets are populated.
  const ar = agingSide(D.INVOICES.filter(i => i.status === 'POSTED').map((i, k) => ({
    partyId: i.customer_id, partyName: i.customer_name, ref: i.invoice_no,
    date: D.at(k % 4 === 0 ? 72 : k % 3 === 0 ? 45 : daysSince(i.date)), amount: i.total_amount,
  })))
  const ap = agingSide(D.POS.filter(p => p.status !== 'DRAFT').map((p, k) => ({
    partyId: p.vendor_id, partyName: p.vendor_name, ref: p.po_no, date: D.at(k % 3 === 0 ? 40 : daysSince(p.date)), amount: p.total_amount,
  })))
  return { ar, ap }
}

function creditBreaches() {
  return D.CUSTOMERS.slice(0, 6).map((c, i) => {
    const outstanding = i === 1 ? c.credit_limit * 1.18 : i === 4 ? c.credit_limit * 1.05 : c.credit_limit * 0.4
    return { customerId: c.id, name: c.name, mobile: c.mobile, email: c.email, outstanding: round(outstanding, 0), creditLimit: c.credit_limit, overBy: round(outstanding - c.credit_limit, 0) }
  }).filter(b => b.overBy > 0)
}

function dashboardSummary() {
  const today = deliveredOn(todayIso())
  const yesterday = deliveredOn(D.dateOnly(D.at(1)))
  const sum = (rows: any[], k: string) => rows.reduce((s, r) => s + num(r[k]), 0)
  const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : null)
  const trend = Array.from({ length: 14 }, (_, i) => {
    const day = D.dateOnly(D.at(13 - i))
    const rows = deliveredOn(day)
    return { date: day, qty: sum(rows, 'qty'), revenue: sum(rows, 'subtotal') }
  })
  const topMap = new Map<string, any>()
  for (const c of D.CHALLANS.filter(c => c.status !== 'DRAFT')) {
    const t = topMap.get(c.customer_id) ?? { customerId: c.customer_id, name: c.customer_name, totalQty: 0, totalRevenue: 0 }
    t.totalQty += c.qty; t.totalRevenue += c.subtotal
    topMap.set(c.customer_id, t)
  }
  const vehMap = new Map<string, any>()
  for (const c of today) {
    const v = vehMap.get(c.vehicle_id) ?? { vehicleId: c.vehicle_id, vehicleNo: c.vehicle_no, trips: 0, totalQty: 0 }
    v.trips++; v.totalQty += c.qty
    vehMap.set(c.vehicle_id, v)
  }
  const qs = qualitySummary()
  const ag = aging()
  const capacity = D.BRANCH.rated_capacity_cum_hr * D.BRANCH.operating_hours_per_day
  const todayQty = sum(today, 'qty')
  return {
    today: { totalQty: todayQty, totalTrips: today.length, wastagePct: 1.4, totalRevenue: sum(today, 'subtotal'), utilizationPct: Math.round((todayQty / capacity) * 100 * 6), capacityCum: capacity },
    yesterday: { totalQty: sum(yesterday, 'qty'), totalTrips: yesterday.length, totalRevenue: sum(yesterday, 'subtotal') },
    change: { qtyPct: pct(todayQty, sum(yesterday, 'qty')), tripsPct: pct(today.length, yesterday.length), revenuePct: pct(sum(today, 'subtotal'), sum(yesterday, 'subtotal')) },
    trend,
    actionItems: { draftChallans: D.CHALLANS.filter(c => c.status === 'DRAFT').length, unbilledChallans: D.CHALLANS.filter(c => c.status === 'ACTIVE' && c.site_out && !c.invoiced).length },
    topCustomers: [...topMap.values()].sort((a, b) => b.totalQty - a.totalQty).slice(0, 6),
    vehicleUtilization: [...vehMap.values()],
    lowStock: D.STOCK.filter(s => s.low).map(s => ({ material: s.label, qty_on_hand: s.qty_on_hand, reorder_level: s.reorder_level })),
    finance: { outstanding: ag.ar.summary.total, overdueCount: ag.ar.rows.filter(r => r.entries.some((e: any) => e.days > 30)).length, overdueAmount: ag.ar.summary.buckets['31-60'] + ag.ar.summary.buckets['60+'] },
    quality: { passRate: qs.passRate, passed: qs.passed, failed: qs.failed },
  }
}

function qualitySummary() {
  const recent = D.QUALITY_TESTS.filter(t => daysSince(t.cast_date) <= 45)
  const passed = recent.filter(t => t.result === 'PASS').length
  const failed = recent.filter(t => t.result === 'FAIL').length
  const pending = recent.filter(t => t.result === 'PENDING').length
  return { passRate: passed + failed ? Math.round((passed / (passed + failed)) * 1000) / 10 : null, passed, failed, pending }
}

function challanLookups() {
  return {
    customers: D.CUSTOMERS.filter(c => c.is_active),
    vehicles: D.VEHICLES.map(v => ({ ...v, capacity: String(v.capacity ?? '') })),
    drivers: D.DRIVERS,
    grades: D.GRADES,
  }
}

function track(code: string) {
  const c = D.CHALLANS.find(x => x.tracking_code === code || x.id === code) ?? D.CHALLANS.find(x => x.status === 'ACTIVE' && !x.site_out) ?? D.CHALLANS[0]
  const step = c.status === 'DRAFT' ? 'PREPARING' : c.site_out ? 'COMPLETED' : c.site_in ? 'ARRIVED' : 'DISPATCHED'
  return {
    ...c, branch_name: D.BRANCH.name, branch_phone: D.BRANCH.phone, branch_city: D.BRANCH.city, step,
    eta: step === 'DISPATCHED' ? { distanceKm: c.eta?.distanceKm ?? 14, travelMinutes: c.eta?.travelMinutes ?? 18, source: 'live' } : null,
  }
}

function chatbot(message: string) {
  const m = message.toLowerCase()
  const s = dashboardSummary()
  if (/dispatch|load|trip/.test(m)) return `Today: ${s.today.totalTrips} loads dispatched, ${s.today.totalQty} m³ in total. ${D.liveRows().length} trucks are out right now.`
  if (/revenue|sales|billing/.test(m)) return `Revenue today is ₹${Math.round(s.today.totalRevenue).toLocaleString('en-IN')}; the last 14 days total ₹${Math.round(s.trend.reduce((a, t) => a + t.revenue, 0)).toLocaleString('en-IN')}.`
  if (/owe|outstanding|receivable|due/.test(m)) return `Outstanding receivables are ₹${Math.round(s.finance.outstanding).toLocaleString('en-IN')}. Largest: ${aging().ar.rows.slice(0, 3).map(r => r.partyName).join(', ')}.`
  if (/stock|material|inventory/.test(m)) return s.lowStock.length ? `Below reorder level: ${s.lowStock.map(l => l.material).join(', ')}.` : 'All materials are above reorder level.'
  if (/driver/.test(m)) return `${D.DRIVERS[0].name} has done the most trips this week (14), followed by ${D.DRIVERS[1].name} (12).`
  return 'I can answer questions about dispatches, revenue, outstanding payments, stock and drivers. (Offline demo data.)'
}

// ─── Route table ─────────────────────────────────────────────────────────
const ROUTES: [string, string, Handler][] = [

  // Dashboard & alerts
  ['GET', '/dashboard/summary', () => dashboardSummary()],
  ['GET', '/dashboard/alerts', () => ({ creditBreaches: creditBreaches(), lowStock: dashboardSummary().lowStock })],
  ['GET', '/sales/challans/dashboard', () => {
    const today = D.CHALLANS.filter(c => c.date === todayIso())
    return { challans: today, inTransit: today.filter(c => c.status === 'ACTIVE' && !c.site_out) }
  }],
  ['POST', '/chatbot/query', req => ({ answer: chatbot(String(req.body?.message ?? '')) })],
  ['POST', '/notifications', () => ({ ok: true })],

  // Sales
  ['GET', '/sales/challans/lookups', () => challanLookups()],
  ['GET', '/sales/challans/pending-schedules', () => D.SCHEDULES.filter(s => s.status === 'ACTIVE').slice(0, 5)],
  ['GET', '/sales/challans/eta-preview', req => ({ batchReadyMinutes: 12, standardTruckMinutes: 8, distanceKm: 14.6, travelMinutes: 32 + Math.round(num(req.query.qty)), totalMinutes: 52 })],
  ['GET', '/sales/challans/:id/notify-links', (_r, p) => {
    const c = D.CHALLANS.find(x => x.id === p.id) ?? D.CHALLANS[0]
    return { whatsapp: { available: true, recipient: c.customer_mobile, link: `https://wa.me/91${c.customer_mobile}` }, email: { available: true, recipient: 'accounts@example.in', link: 'mailto:accounts@example.in' } }
  }],
  ['POST', '/sales/challans/:id/post', (_r, p) => Object.assign(D.CHALLANS.find(x => x.id === p.id) ?? {}, { status: 'ACTIVE', dispatch_time: new Date().toISOString() })],
  ...crud('/sales/challans', D.CHALLANS, { search: ['challan_no', 'customer_name', 'job_site', 'vehicle_no'], numberField: 'challan_no', prefix: 'CH', softDelete: false, defaults: () => ({ date: todayIso(), dispatch_time: new Date().toISOString(), ...D.branchFields(), tracking_code: `TRK${Date.now() % 1_000_000}` }) }),
  ['GET', '/sales/schedules/suggest-vehicles', () => D.SCHEDULES.filter(s => s.date === todayIso()).slice(0, 4).map((s, i) => ({
    scheduleId: s.id, schNo: s.sch_no, jobSite: s.job_site, gradeName: s.grade_name, qty: s.qty, startTime: s.start_time,
    suggestedVehicleId: D.VEHICLES[i].id, suggestedVehicleNo: D.VEHICLES[i].vehicle_no,
    reason: i === 0 ? 'Back at plant, closest to the site' : 'Free after current trip', warning: i === 3 ? 'Only a 6 m³ truck is free — plan two trips' : null,
  }))],
  ...crud('/sales/schedules', D.SCHEDULES, { search: ['sch_no', 'job_site', 'customer_name'], numberField: 'sch_no', prefix: 'SCH', softDelete: false }),
  ...crud('/sales/orders', D.ORDERS, { search: ['order_no', 'job_site', 'customer_name'], numberField: 'order_no', prefix: 'SO', softDelete: false }),

  // Marketing
  ['GET', '/marketing/tenders/lookups', () => ({ customers: D.CUSTOMERS })],
  ['PATCH', '/marketing/tenders/:id/status', (req, p) => Object.assign(D.TENDERS.find(t => t.id === p.id) ?? notFound(), { status: req.body?.status, lost_reason: req.body?.lostReason ?? null })],
  ['POST', '/marketing/tenders/:id/convert-to-quotation', (_r, p) => {
    const t = D.TENDERS.find(x => x.id === p.id) ?? notFound()
    t.status = 'QUOTED'
    return D.QUOTATIONS[0]
  }],
  ...crud('/marketing/tenders', D.TENDERS, { search: ['tender_no', 'customer_name', 'project_site'], numberField: 'tender_no', prefix: 'TND', softDelete: false, defaults: () => ({ status: 'NEW' }) }),
  ...crud('/marketing/quotations', D.QUOTATIONS, { search: ['quot_no', 'project_site', 'customer_name'], numberField: 'quot_no', prefix: 'QT', softDelete: false, defaults: () => D.branchFields() }),

  // Finance
  ['GET', '/finance/invoices/pending-challans', req => D.CHALLANS.filter(c => c.status === 'ACTIVE' && c.site_out && !c.invoiced && (!req.query.customer_id || c.customer_id === req.query.customer_id))],
  ['GET', '/finance/invoices/:id/einvoice-payload', (_r, p) => ({ payload: { Version: '1.1', DocDtls: { Typ: 'INV', No: D.INVOICES.find(i => i.id === p.id)?.invoice_no }, SellerDtls: { Gstin: D.BRANCH.gstin } }, warnings: ['Offline demo — nothing is sent to the IRP'], alreadyFiled: false })],
  ['GET', '/finance/invoices/:id/ewaybill-payload', () => ({ payload: { supplyType: 'O', docType: 'INV', transMode: '1' }, warnings: ['Offline demo — nothing is sent to the portal'], alreadyFiled: false })],
  ['GET', '/finance/invoices/:id/notify-links', () => ({ whatsapp: { available: true, recipient: '9845012345', link: 'https://wa.me/919845012345' }, email: { available: true, recipient: 'accounts@example.in', link: 'mailto:accounts@example.in' } })],
  ['POST', '/finance/invoices/:id/post', (_r, p) => Object.assign(D.INVOICES.find(i => i.id === p.id) ?? notFound(), { status: 'POSTED' })],
  ['POST', '/finance/invoices/:id/approve', (_r, p) => Object.assign(D.INVOICES.find(i => i.id === p.id) ?? notFound(), { status: 'POSTED' })],
  ['POST', '/finance/invoices/:id/reject', (_r, p) => Object.assign(D.INVOICES.find(i => i.id === p.id) ?? notFound(), { status: 'DRAFT' })],
  ['POST', '/finance/invoices', req => {
    const ids: string[] = req.body?.challan_ids ?? req.body?.challanIds ?? []
    const chs = D.CHALLANS.filter(c => ids.includes(c.id))
    const c = D.CUSTOMERS.find(x => x.id === req.body?.customer_id) ?? D.CUSTOMERS[0]
    const subtotal = chs.reduce((s, x) => s + x.subtotal, 0)
    const tax = round(subtotal * 0.18)
    const inv = { ...D.INVOICES[0], id: D.newId('inv'), invoice_no: `INV-${++numberSeq}`, date: todayIso(), ...D.customerFields(c), subtotal, cgst: tax / 2, sgst: tax / 2, igst: 0, tax_amount: tax, total_amount: subtotal + tax, status: 'DRAFT', irn: null, ack_no: null, ack_date: null, items: chs.map(x => ({ id: `ii-${x.id}`, description: `Ready Mix Concrete ${x.grade_name}`, qty: x.qty, rate: x.rate, amount: x.subtotal, challan_no: x.challan_no, challan_date: x.date, grade_name: x.grade_name })) }
    chs.forEach(x => { x.invoiced = true })
    D.INVOICES.unshift(inv)
    return inv
  }],
  ...crud('/finance/invoices', D.INVOICES, { search: ['invoice_no', 'customer_name'], softDelete: false }),
  ...crud('/finance/payments', D.PAYMENTS, { search: ['number', 'vendor_name', 'ledger_name'], numberField: 'number', prefix: 'PV', softDelete: false }),
  ...crud('/finance/receipts', D.RECEIPTS, { search: ['number', 'customer_name', 'ledger_name'], numberField: 'number', prefix: 'RV', softDelete: false }),
  ...crud('/finance/journals', D.JOURNALS, { search: ['number', 'ledger_name'], numberField: 'number', prefix: 'JV', softDelete: false }),
  ['GET', '/finance/cashbook', req => {
    const entries: any[] = []
    let balance = 48500
    const opening = balance
    const cash = [
      ...D.RECEIPTS.map(r => ({ id: r.id, number: r.number, date: r.date, direction: 'IN', party: r.customer_name, remarks: 'Cash receipt', amount: Math.round(r.pay_amount * 0.05) })),
      ...D.PAYMENTS.map(p => ({ id: p.id, number: p.number, date: p.date, direction: 'OUT', party: p.vendor_name, remarks: 'Petty expense', amount: Math.round(p.pay_amount * 0.04) })),
    ].sort((a, b) => a.date.localeCompare(b.date))
    for (const e of cash) { balance += e.direction === 'IN' ? e.amount : -e.amount; entries.push({ ...e, balance }) }
    const totalIn = cash.filter(e => e.direction === 'IN').reduce((s, e) => s + e.amount, 0)
    const totalOut = cash.filter(e => e.direction === 'OUT').reduce((s, e) => s + e.amount, 0)
    return { from: req.query.from ?? D.dateOnly(D.at(30)), to: req.query.to ?? todayIso(), openingBalance: opening, entries, totalIn, totalOut, closingBalance: balance }
  }],

  // Stores
  ['POST', '/stores/po/:id/approve', (_r, p) => Object.assign(D.POS.find(x => x.id === p.id) ?? notFound(), { status: 'ACTIVE' })],
  ['POST', '/stores/po/:id/reject', (_r, p) => Object.assign(D.POS.find(x => x.id === p.id) ?? notFound(), { status: 'DRAFT' })],
  ...crud('/stores/po', D.POS, { search: ['po_no', 'vendor_name'], numberField: 'po_no', prefix: 'PO', softDelete: false, defaults: b => ({ total_amount: num(b?.sub_total) * 1.18, ...D.branchFields() }) }),
  ['GET', '/stores/grn/vendor-pos', req => D.POS.filter(p => p.vendor_id === req.query.vendor_id && p.status === 'ACTIVE')],
  ...crud('/stores/grn', D.GRNS, { search: ['number', 'vendor_name', 'party_challan_no'], numberField: 'number', prefix: 'GRN', softDelete: false, defaults: () => D.branchFields() }),
  ...crud('/stores/indents', D.INDENTS, { search: ['indent_no', 'dept_name'], numberField: 'indent_no', prefix: 'IND', softDelete: false }),
  ['GET', '/stores/stock/balance', () => D.STOCK],
  ['GET', '/stores/stock/movements', () => D.STOCK.slice(0, 8).flatMap((s, i) => [
    { id: `mv-${i}-a`, material: s.label, movement_type: 'INWARD', qty: Math.round(s.reorder_level * 0.4), ref_type: 'GRN', note: D.GRNS[i % 9].number, created_by: 'Kiran Desai', created_at: D.minutesAgo(i * 180 + 40) },
    { id: `mv-${i}-b`, material: s.label, movement_type: 'CONSUMPTION', qty: -Math.round(s.reorder_level * 0.05), ref_type: 'BATCH', note: D.BATCHES[i % 8].batch_no, created_by: 'System', created_at: D.minutesAgo(i * 180 + 12) },
  ]).slice(0, 15)],
  ['GET', '/stores/stock/reorder-forecast', () => D.STOCK.map(s => {
    const daily = Math.round(s.reorder_level / 12)
    const days = Math.max(0, Math.round((s.qty_on_hand - s.reorder_level) / daily))
    return { material: s.material, label: s.label, uom: s.uom, qtyOnHand: s.qty_on_hand, reorderLevel: s.reorder_level, historicalDailyRate: daily, scheduledDailyRate: Math.round(daily * 1.1), projectedDailyRate: Math.round(daily * 1.05), daysUntilReorder: s.low ? 0 : days, suggestedOrderQty: s.low ? s.reorder_level : 0, risk: s.low ? 'HIGH' : days < 5 ? 'MEDIUM' : days < 10 ? 'LOW' : 'NONE' }
  })],
  ['POST', '/stores/stock/inward', req => {
    const s = D.STOCK.find(x => x.material === req.body?.material)
    if (s) { s.qty_on_hand += num(req.body?.qty); s.low = s.qty_on_hand < s.reorder_level }
    return s ?? {}
  }],
  ['PUT', '/stores/stock/reorder-level', req => {
    const s = D.STOCK.find(x => x.material === req.body?.material)
    if (s) { s.reorder_level = num(req.body?.reorder_level); s.low = s.qty_on_hand < s.reorder_level }
    return s ?? {}
  }],

  // Masters
  ['GET', '/masters/customers/:id/statement', (_r, p) => {
    const c = D.CUSTOMERS.find(x => x.id === p.id) ?? notFound()
    let balance = 0
    const rows = [
      ...D.INVOICES.filter(i => i.customer_id === c.id).map(i => ({ date: i.date, type: 'INVOICE', vchType: 'Sales', particulars: 'Sales A/c', ref: i.invoice_no, debit: i.total_amount, credit: 0 })),
      ...D.RECEIPTS.filter(r => r.customer_id === c.id).map(r => ({ date: r.date, type: 'RECEIPT', vchType: 'Receipt', particulars: r.bank_name ?? 'Bank', ref: r.number, debit: 0, credit: r.pay_amount })),
    ].sort((a, b) => a.date.localeCompare(b.date)).map(r => ({ ...r, balance: (balance += r.debit - r.credit) }))
    return { branch: { name: D.BRANCH.name, address: D.BRANCH.address, gstin: D.BRANCH.gstin, company_id: D.COMPANY.id }, customer: { id: c.id, name: c.name, gstin: c.gstin, address: c.address }, openingBalance: 0, rows, closingBalance: balance }
  }],
  ['GET', '/masters/customers/:id/credit-status', (_r, p) => {
    const c = D.CUSTOMERS.find(x => x.id === p.id) ?? notFound()
    const breach = creditBreaches().find(b => b.customerId === c.id)
    const outstanding = breach?.outstanding ?? Math.round(Math.max(0, outstandingFor(c.id)))
    return { creditLimit: c.credit_limit, outstanding, overLimit: !!breach, overBy: breach?.overBy ?? 0, overdueCount: breach ? 2 : 0, overdueAmount: breach ? Math.round(outstanding * 0.3) : 0, oldestOverdueDays: breach ? 48 : 0 }
  }],
  ['PUT', '/masters/customers/:id/credit-hold', (req, p) => Object.assign(D.CUSTOMERS.find(x => x.id === p.id) ?? notFound(), { credit_hold: !!req.body?.credit_hold, credit_hold_reason: req.body?.reason ?? req.body?.credit_hold_reason ?? null })],
  ['PUT', '/masters/customers/:id/portal-access', (req, p) => Object.assign(D.CUSTOMERS.find(x => x.id === p.id) ?? notFound(), req.body)],
  ['POST', '/masters/customers/import', req => ({ created: (req.body?.rows ?? []).length, updated: 0, skipped: 0, errors: [] })],
  ...crud('/masters/customers', D.CUSTOMERS, { search: ['name', 'code', 'gstin', 'mobile', 'city'], numberField: 'code', prefix: 'C' }),
  ['GET', '/masters/customer-rates/lookup', req => D.CUSTOMER_RATES.find(r => r.customer_id === req.query.customer_id && r.grade_name === req.query.grade_name) ?? null],
  ...crud('/masters/customer-rates', D.CUSTOMER_RATES, { search: ['customer_name', 'grade_name'], defaults: b => ({ customer_name: D.CUSTOMERS.find(c => c.id === b?.customer_id)?.name }) }),
  ...crud('/masters/items', D.ITEMS, { search: ['name', 'item_no', 'category', 'hsn_code'], numberField: 'item_no', prefix: 'ITM' }),
  ['GET', '/masters/vendors/lookup', () => D.VENDORS.filter(v => v.is_active)],
  ['GET', '/masters/vendors/:id/history', (req, p) => {
    const v = D.VENDORS.find(x => x.id === p.id) ?? notFound()
    const pos = D.POS.filter(x => x.vendor_id === v.id)
    const grns = D.GRNS.filter(x => x.vendor_id === v.id)
    const pays = D.PAYMENTS.filter(x => x.vendor_id === v.id)
    const type = String(req.query.type ?? 'PO')
    const tx = type === 'GRN' ? grns.map(g => ({ type: 'GRN', id: g.id, number: g.number, date: g.date, amount: g.total_amount, status: g.status, remarks: g.party_challan_no }))
      : type === 'PAYMENT' ? pays.map(x => ({ type: 'PAYMENT', id: x.id, number: x.number, date: x.date, amount: x.pay_amount, status: x.status, remarks: x.trans_type }))
      : pos.map(x => ({ type: 'PO', id: x.id, number: x.po_no, date: x.date, amount: x.total_amount, status: x.status, remarks: x.po_type }))
    const totalPos = pos.reduce((s, x) => s + x.total_amount, 0)
    const paid = pays.reduce((s, x) => s + x.pay_amount, 0)
    return { transactions: paginate(tx, req.query).data, total: tx.length, summary: { total_pos: pos.length, total_pos_amount: totalPos, total_grns: grns.length, total_grns_qty: grns.reduce((s, g) => s + g.total_qty, 0), total_paid: paid, outstanding: Math.max(0, totalPos - paid) } }
  }],
  ['GET', '/masters/vendors/:id/ledger', (_r, p) => {
    let balance = 0
    return [
      ...D.GRNS.filter(g => g.vendor_id === p.id).map(g => ({ date: g.date, type: 'GRN', reference_no: g.number, debit: 0, credit: g.total_amount, remarks: g.party_challan_no })),
      ...D.PAYMENTS.filter(x => x.vendor_id === p.id).map(x => ({ date: x.date, type: 'PAYMENT', reference_no: x.number, debit: x.pay_amount, credit: 0, remarks: x.trans_type })),
    ].sort((a, b) => a.date.localeCompare(b.date)).map(r => ({ ...r, balance: (balance += r.debit - r.credit) }))
  }],
  ['POST', '/masters/vendors/import', req => ({ created: (req.body?.rows ?? []).length, updated: 0, skipped: 0, errors: [] })],
  ...crud('/masters/vendors', D.VENDORS, { search: ['name', 'code', 'gstin', 'mobile', 'city'], numberField: 'code', prefix: 'V', defaults: () => ({ total_pos: 0, total_grns: 0, outstanding_amount: 0 }) }),
  ['POST', '/masters/vehicles/import', req => ({ created: (req.body?.rows ?? []).length, updated: 0, skipped: 0, errors: [] })],
  ...crud('/masters/vehicles', D.VEHICLES, { search: ['vehicle_no', 'owner_name', 'vehicle_type'] }),
  ['PUT', '/masters/drivers/:id/app-access', (req, p) => Object.assign(D.DRIVERS.find(x => x.id === p.id) ?? notFound(), { app_enabled: req.body?.app_enabled ?? true })],
  ['POST', '/masters/drivers/import', req => ({ created: (req.body?.rows ?? []).length, updated: 0, skipped: 0, errors: [] })],
  ...crud('/masters/drivers', D.DRIVERS, { search: ['name', 'mobile', 'license_no'] }),
  ...crud('/masters/users', D.USERS, { search: ['name', 'email', 'role'], defaults: b => ({ branch_name: D.BRANCHES.find(x => x.id === b?.branch_id)?.name ?? null }) }),
  ...crud('/masters/pumps', D.PUMPS, { search: ['pump_no', 'operator_name'] }),
  ['GET', '/masters/grades/:id/versions', (_r, p) => {
    const g = D.GRADES.find(x => x.id === p.id) ?? notFound()
    return Array.from({ length: g.version }, (_, i) => {
      const v = g.version - i
      return { id: `${g.id}-v${v}`, grade_name: g.grade_name, version: v, is_current: i === 0, cement_qty: g.cement_qty + i * 10, mm20_qty: g.mm20_qty, water_qty: g.water_qty + i * 5, water_ratio: round(g.water_ratio + i * 0.02, 2), created_at: D.at(i * 60 + 5), superseded_at: i === 0 ? null : D.at((i - 1) * 60 + 5) }
    })
  }],
  ['POST', '/masters/grades/:id/new-version', (req, p) => Object.assign(D.GRADES.find(x => x.id === p.id) ?? notFound(), req.body, { version: (D.GRADES.find(x => x.id === p.id)?.version ?? 1) + 1 })],
  ...crud('/masters/grades', D.GRADES, { search: ['grade_name', 'grade_code'], defaults: () => ({ version: 1, branch_id: D.BRANCH.id }) }),
  ...crud('/masters/branches', D.BRANCHES, { search: ['name', 'code'] }),
  ['POST', '/masters/company/logo', () => ({ ok: true })],
  ['DELETE', '/masters/company/logo', () => ({ ok: true })],

  // Production
  ['GET', '/production/batches/connectivity', () => ({
    bySyncStatus: { SYNCED: D.BATCHES.filter(b => b.sync_status === 'SYNCED').length, PENDING: D.BATCHES.filter(b => b.sync_status === 'PENDING').length, FAILED: D.BATCHES.filter(b => b.sync_status === 'FAILED').length },
    worker: { lastCycleAt: D.minutesAgo(2), lastCycleResult: { attempted: 3, recovered: 2 } },
  })],
  ['GET', '/production/batches/:id', (_r, p) => {
    const b = D.BATCHES.find(x => x.id === p.id) ?? notFound()
    const g = D.GRADES.find(x => x.id === b.grade_id) ?? D.GRADES[4]
    const running = b.status === 'BATCHING'
    const materials = D.batchMaterials(g, num(b.batch_qty_cum), b.status === 'COMPLETED', running ? 0.7 : 0)
    const ch = D.CHALLANS.find(c => c.id === b.challan_id)
    return { ...b, materials, totalVarianceCost: materials.reduce((s, m) => s + (m.variance_cost ?? 0), 0), timeline: { batchCompletedAt: b.status === 'COMPLETED' ? b.created_at : null, dispatchTime: ch?.dispatch_time ?? null, siteIn: ch?.site_in ?? null, siteOut: ch?.site_out ?? null } }
  }],
  ['POST', '/production/batches/:id/sync', (_r, p) => Object.assign(D.BATCHES.find(x => x.id === p.id) ?? notFound(), { sync_status: 'SYNCED' })],
  ['POST', '/production/batches/:id/complete', (_r, p) => Object.assign(D.BATCHES.find(x => x.id === p.id) ?? notFound(), { status: 'COMPLETED' })],
  ['POST', '/production/batches', req => {
    const g = D.GRADES.find(x => x.id === req.body?.grade_id) ?? D.GRADES[4]
    const ch = D.CHALLANS.find(c => c.id === req.body?.challan_id)
    const b = { id: D.newId('batch'), batch_no: `B-${++numberSeq}`, grade_id: g.id, grade_name: g.grade_name, grade_version: g.version, batch_qty_cum: num(req.body?.batch_qty_cum), status: 'REQUESTED', source: 'MANUAL', sync_status: 'PENDING', plc_batch_ref: null, mixer_no: req.body?.mixer_no ?? null, operator: req.body?.operator ?? null, remarks: req.body?.remarks ?? null, challan_id: ch?.id ?? null, challan_no: ch?.challan_no ?? null, job_site: ch?.job_site ?? null, customer_name: ch?.customer_name ?? null, created_at: new Date().toISOString() }
    D.BATCHES.unshift(b)
    return b
  }],
  ...crud('/production/batches', D.BATCHES, { search: ['batch_no', 'challan_no', 'job_site', 'customer_name'], softDelete: false }),
  ['PUT', '/production/weighbridge/:id/tare', (req, p) => {
    const t = D.WEIGHBRIDGE.find(x => x.id === p.id) ?? notFound()
    return Object.assign(t, { tare_weight: num(req.body?.tare_weight), tare_time: new Date().toISOString(), net_weight: num(t.gross_weight) - num(req.body?.tare_weight), status: 'COMPLETED' })
  }],
  ...crud('/production/weighbridge', D.WEIGHBRIDGE, { search: ['ticket_no', 'vehicle_no', 'vehicle_no_manual', 'challan_no'], numberField: 'ticket_no', prefix: 'WB', softDelete: false, defaults: () => ({ status: 'GROSS_CAPTURED', gross_time: new Date().toISOString() }) }),
  ['GET', '/production/reconciliation', req => ({
    from: req.query.from ?? D.dateOnly(D.at(30)), to: req.query.to ?? todayIso(),
    rows: D.STOCK.map((s, i) => {
      const opening = Math.round(s.qty_on_hand * 0.9), inward = Math.round(s.reorder_level * 0.8), outward = Math.round(s.reorder_level * 0.75)
      const expected = opening + inward - outward
      const counted = i % 3 === 2 ? null : Math.round(expected * (1 - (i % 2 ? 0.012 : 0.004)))
      const variance = counted == null ? null : counted - expected
      return { material: s.material, label: s.label, uom: s.uom, opening, inward, outward, adjustments: 0, expectedClosing: expected, countedQty: counted, countDate: counted == null ? null : D.dateOnly(D.at(2)), countStale: counted == null ? null : false, variance, varianceCost: variance == null ? null : round(variance * s.avg_cost, 0), avgCost: s.avg_cost }
    }),
  })],
  ['POST', '/production/reconciliation/count', () => ({ ok: true })],
  ['GET', '/production/concrete-age/live', () => {
    const rows = D.CHALLANS.filter(c => c.status === 'ACTIVE' && !c.site_out).map(c => {
      const age = Math.round((Date.now() - new Date(c.dispatch_time).getTime()) / 60_000) + 15
      const status = age >= D.BRANCH.concrete_age_yellow_min ? 'RED' : age >= D.BRANCH.concrete_age_green_min ? 'YELLOW' : 'GREEN'
      return { id: c.id, challan_no: c.challan_no, job_site: c.job_site, grade_name: c.grade_name, qty: c.qty, customer_name: c.customer_name, vehicle_no: c.vehicle_no, driver_name: c.driver_name, arrived: !!c.site_in, ageSource: 'BATCH', ageMinutes: age, status, minutesToYellow: Math.max(0, D.BRANCH.concrete_age_green_min - age), minutesToRed: Math.max(0, D.BRANCH.concrete_age_yellow_min - age) }
    })
    return { branch: { id: D.BRANCH.id, name: D.BRANCH.name, greenMin: D.BRANCH.concrete_age_green_min, yellowMin: D.BRANCH.concrete_age_yellow_min }, rows, summary: { total: rows.length, green: rows.filter(r => r.status === 'GREEN').length, yellow: rows.filter(r => r.status === 'YELLOW').length, red: rows.filter(r => r.status === 'RED').length } }
  }],
  ['GET', '/production/pump-bookings/board', req => {
    const day = String(req.query.date ?? todayIso())
    const slot = (h: number, len: number) => ({ start: `${day}T${String(h).padStart(2, '0')}:00:00`, end: `${day}T${String(h + len).padStart(2, '0')}:00:00` })
    return {
      date: day,
      pumps: D.PUMPS.map((p, i) => ({
        id: p.id, pump_no: p.pump_no, pump_type: p.pump_type, ownership: p.ownership,
        bookings: [[8, 3], [13, 2], [16, 2]].slice(0, 3 - (i % 2)).map(([h, len], k) => {
          const s = slot(h + i, len)
          return { id: `pb-${i}-${k}`, pump_id: p.id, job_site: D.CUSTOMERS[(i + k) % 10].job_site, scheduled_start: s.start, scheduled_end: s.end, status: k === 0 ? 'COMPLETED' : k === 1 ? 'IN_PROGRESS' : 'SCHEDULED', challan_no: k === 0 ? D.CHALLANS[i + 5].challan_no : null }
        }),
      })),
    }
  }],
  ['POST', '/production/pump-bookings', req => ({ id: D.newId('pb'), ...req.body })],
  ['POST', '/production/pump-bookings/:id/status', req => ({ ok: true, status: req.body?.status })],
  ['GET', '/production/oee', req => {
    const days = Math.max(1, Math.round((new Date(String(req.query.to ?? todayIso())).getTime() - new Date(String(req.query.from ?? todayIso())).getTime()) / 86_400_000) + 1)
    const planned = days * 600, downtime = days * 38, run = planned - downtime
    const ideal = run / 60 * D.BRANCH.rated_capacity_cum_hr * 0.5, actual = ideal * 0.88
    const availability = run / planned, performance = actual / ideal, quality = 0.97
    return { from: req.query.from, to: req.query.to, days, plannedMinutes: planned, downtimeMinutes: downtime, runTimeMinutes: run, actualOutputCum: round(actual, 1), idealOutputCum: round(ideal, 1), availability, performance, quality, oee: availability * performance * quality, qualityIsProxy: false, testsTotal: 64, testsPassed: 62, downtimeByType: { BREAKDOWN: days * 14, PLANNED_MAINTENANCE: days * 12, MATERIAL_SHORTAGE: days * 8, POWER_OUTAGE: days * 4 }, hasCapacityData: true }
  }],
  ['GET', '/production/oee/downtime', () => [
    { id: 'dt-1', equipment: 'MIXER', downtime_type: 'PLANNED_MAINTENANCE', start_time: D.minutesAgo(190), end_time: D.minutesAgo(176), reason: 'Mixer cleaning' },
    { id: 'dt-2', equipment: 'CONVEYOR', downtime_type: 'MATERIAL_SHORTAGE', start_time: D.minutesAgo(95), end_time: D.minutesAgo(87), reason: 'Aggregate bin empty — loader delay' },
    { id: 'dt-3', equipment: 'BATCHING_PLANT', downtime_type: 'BREAKDOWN', start_time: D.at(1, 14, 10), end_time: D.at(1, 14, 52), reason: 'Load cell calibration fault' },
    { id: 'dt-4', equipment: 'WEIGHBRIDGE', downtime_type: 'POWER_OUTAGE', start_time: D.at(3, 11, 0), end_time: D.at(3, 11, 25), reason: 'Grid power cut' },
  ]],
  ['POST', '/production/oee/downtime', req => ({ id: D.newId('dt'), ...req.body, start_time: new Date().toISOString(), end_time: null })],
  ['POST', '/production/oee/downtime/:id/end', () => ({ ok: true })],
  ['GET', '/production/energy/summary', req => {
    const daily = Array.from({ length: 14 }, (_, i) => {
      const kwh = 820 + ((i * 37) % 160), diesel = 40 + ((i * 13) % 30), gen = i % 5 === 0 ? 2.5 : 0.5
      return { date: D.dateOnly(D.at(13 - i)), electricity_kwh: kwh, diesel_liters: diesel, generator_hours: gen, cost: round(kwh * 8.2 + diesel * 89.6, 0) }
    })
    const totalKwh = daily.reduce((s, d) => s + d.electricity_kwh, 0), totalDiesel = daily.reduce((s, d) => s + d.diesel_liters, 0)
    const electricityCost = round(totalKwh * 8.2, 0), dieselCost = round(totalDiesel * 89.6, 0), outputCum = dashboardSummary().trend.reduce((s, t) => s + t.qty, 0)
    return { from: req.query.from, to: req.query.to, totalKwh, totalDiesel, totalGenHours: daily.reduce((s, d) => s + d.generator_hours, 0), electricityCost, dieselCost, totalCost: electricityCost + dieselCost, outputCum, perCum: outputCum ? { kwhPerCum: round(totalKwh / outputCum), dieselPerCum: round(totalDiesel / outputCum), costPerCum: round((electricityCost + dieselCost) / outputCum) } : null, daily }
  }],
  ['POST', '/production/energy', req => ({ id: D.newId('en'), ...req.body })],
  ['GET', '/production/carbon', req => {
    const outputCum = dashboardSummary().trend.reduce((s, t) => s + t.qty, 0)
    const rows = [['cement', 'Cement', 330, 0.9], ['ggbs', 'GGBS', 70, 0.07], ['mm20', 'Coarse aggregate', 1100, 0.005], ['csand', 'Sand', 720, 0.004], ['admix', 'Admixture', 3.2, 1.9]]
      .map(([material, label, perCum, factor]) => { const qty = round((perCum as number) * outputCum, 0); return { material, label, qty, factor, kgco2e: round(qty * (factor as number), 0) } })
    const materialKgCO2e = rows.reduce((s, r) => s + r.kgco2e, 0), electricityKgCO2e = 9400, dieselKgCO2e = 1650
    const total = materialKgCO2e + electricityKgCO2e + dieselKgCO2e
    return { from: req.query.from, to: req.query.to, materialRows: rows, materialKgCO2e, electricityKgCO2e, dieselKgCO2e, totalKgCO2e: total, totalTonnesCO2e: round(total / 1000, 1), outputCum, kgco2ePerCum: outputCum ? round(total / outputCum, 1) : null, scmReplacementPct: 17.5, scopeNote: 'Cradle-to-gate: materials, plant electricity and diesel.', factorsAreApproximate: true }
  }],

  // Quality
  ['GET', '/quality/summary', () => qualitySummary()],
  ['GET', '/quality/predictions', () => ({
    predictions: D.QUALITY_TESTS.filter(t => t.age_days === 7 && t.result !== 'PENDING').slice(0, 6).map((t, i) => {
      const target = Number(String(t.grade_name).slice(1))
      const predicted = round(num(t.actual_strength) / 0.68, 1)
      return { testId: t.id, challanId: t.challan_id, challanNo: t.challan_no, customerName: t.customer_name, jobSite: t.job_site, gradeName: t.grade_name, cubeId: t.cube_id, castDate: t.cast_date, sevenDayActual: num(t.actual_strength), sevenDayTestDate: t.test_date, targetStrength: target, predicted, marginLow: round(predicted - 2.4, 1), marginHigh: round(predicted + 2.4, 1), method: i % 3 === 0 ? 'branch-regression' : 'grade-regression', sampleSize: 18 + i * 3, risk: predicted < target ? 'HIGH' : predicted < target * 1.05 ? 'MEDIUM' : 'LOW' }
    }),
    modelInfo: { gradesWithOwnModel: ['M25', 'M30'], branchWideSampleSize: 142, minPairsRequired: 12, fallbackRatio: 0.68, fallbackMargin: 3 },
  })],
  ['POST', '/quality/ncr/:id/advance', (req, p) => {
    const flow = ['OPEN', 'ROOT_CAUSE', 'CORRECTIVE_ACTION', 'VERIFICATION', 'CLOSED']
    const n = D.NCRS.find(x => x.id === p.id) ?? notFound()
    return Object.assign(n, req.body, { status: flow[Math.min(flow.length - 1, flow.indexOf(n.status) + 1)] })
  }],
  ...crud('/quality/ncr', D.NCRS, { search: ['ncr_no', 'description'], numberField: 'ncr_no', prefix: 'NCR', softDelete: false, defaults: () => ({ status: 'OPEN', raised_by: 'Demo Admin' }) }),
  ...crud('/quality', D.QUALITY_TESTS, { search: ['cube_id', 'challan_no', 'customer_name', 'grade_name'], softDelete: false, defaults: () => ({ result: 'PENDING', ...D.branchFields() }) }),

  // Fleet & tracking
  ['GET', '/fleet/live', () => D.liveRows()],
  ['GET', '/fleet/maintenance/forecast', () => D.VEHICLES.slice(0, 8).map((v, i) => {
    const m = D.MAINTENANCE.find(x => x.vehicle_id === v.id && x.next_due_date)
    const overdue = m && m.next_due_date <= todayIso()
    return { vehicleId: v.id, vehicleNo: v.vehicle_no, lastServiceType: m?.service_type ?? null, lastServiceDate: m?.service_date ?? null, nextDueDate: m?.next_due_date ?? null, nextDueOdometer: 50000 + i * 2300, currentOdometer: 47000 + i * 2400, kmPerDay: 120 + i * 8, effectiveDays: overdue ? -3 : 20 + i * 4, risk: overdue ? 'OVERDUE' : i === 5 ? 'DUE_SOON' : m ? 'OK' : 'UNKNOWN', reason: overdue ? 'Service date passed' : i === 5 ? 'Odometer within 800 km of service' : 'On schedule' }
  })],
  ...crud('/fleet/maintenance', D.MAINTENANCE, { softDelete: false, defaults: b => ({ vehicle_no: D.VEHICLES.find(v => v.id === b?.vehicle_id)?.vehicle_no }) }),
  ['GET', '/fleet/fuel/summary', () => D.VEHICLES.slice(0, 8).map(v => {
    const fills = D.FUEL.filter(f => f.vehicle_id === v.id)
    return { vehicleId: v.id, vehicleNo: v.vehicle_no, litres: fills.reduce((s, f) => s + f.litres, 0), amount: fills.reduce((s, f) => s + f.amount, 0), fills: fills.length }
  })],
  ...crud('/fleet/fuel', D.FUEL, { softDelete: false, defaults: b => ({ vehicle_no: D.VEHICLES.find(v => v.id === b?.vehicle_id)?.vehicle_no, amount: num(b?.litres) * num(b?.rate || 89.6) }) }),

  // Reports
  ['GET', '/reports/aging', () => aging()],
  ['GET', '/reports/aging-summary', () => { const a = aging(); return { ar: a.ar.summary, ap: a.ap.summary } }],
  ['GET', '/reports/profitability', req => {
    const rows = D.CHALLANS.filter(c => c.status !== 'DRAFT' && (!req.query.customer_id || c.customer_id === req.query.customer_id)).slice(0, 40).map(c => {
      const cogs = round(c.subtotal * (0.68 + (c.qty % 3) * 0.04), 0)
      return { id: c.id, challanNo: c.challan_no, date: c.date, jobSite: c.job_site, gradeName: c.grade_name, qty: c.qty, customerName: c.customer_name, vehicleNo: c.vehicle_no, revenue: c.subtotal, cogs, profit: c.subtotal - cogs, marginPct: round(((c.subtotal - cogs) / c.subtotal) * 100, 1) }
    })
    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0), totalCogs = rows.reduce((s, r) => s + r.cogs, 0)
    return { rows, summary: { count: rows.length, totalRevenue, totalCogs, totalProfit: totalRevenue - totalCogs, marginPct: totalRevenue ? round(((totalRevenue - totalCogs) / totalRevenue) * 100, 1) : null } }
  }],
  ['GET', '/reports/sales-analysis', req => {
    const months = Array.from({ length: Number(req.query.months ?? 6) }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (Number(req.query.months ?? 6) - 1 - i))
      const qty = 2600 + ((i * 431) % 900)
      return { month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, qty, revenue: qty * 5100, trips: Math.round(qty / 6.8) }
    })
    const byGrade = D.GRADES.slice(1).map((g, i) => ({ grade: g.grade_name, qty: [320, 980, 1450, 1720, 610, 240][i], revenue: [320, 980, 1450, 1720, 610, 240][i] * (4200 + i * 350) }))
    const byCustomer = dashboardSummary().topCustomers.map(t => ({ customerId: t.customerId, customerName: t.name, qty: t.totalQty * 9, revenue: t.totalRevenue * 9 }))
    return { months, byGrade, byCustomer }
  }],
  ['GET', '/reports/capacity', req => {
    const cap = D.BRANCH.rated_capacity_cum_hr * D.BRANCH.operating_hours_per_day
    const days = dashboardSummary().trend.map(t => ({ date: t.date, actualQtyCum: t.qty, theoreticalCapacityCum: cap, utilizationPct: round((t.qty / cap) * 100 * 6, 1) }))
    const total = days.reduce((s, d) => s + d.actualQtyCum, 0)
    return { branchId: String(req.query.branch_id ?? D.BRANCH.id), ratedCapacityCumHr: D.BRANCH.rated_capacity_cum_hr, operatingHoursPerDay: D.BRANCH.operating_hours_per_day, address: D.BRANCH.address, avgDeliverySpeedKmph: 24, days, totalActualQtyCum: total, totalTheoreticalCapacityCum: cap * days.length, avgUtilizationPct: round(days.reduce((s, d) => s + (d.utilizationPct ?? 0), 0) / days.length, 1) }
  }],
  ['GET', '/reports/credit-risk', () => {
    const rows = D.CUSTOMERS.slice(0, 10).map((c, i) => {
      const outstanding = Math.round(c.credit_limit * [1.18, 0.35, 0.62, 0.2, 1.05, 0.48, 0.9, 0.15, 0.7, 0.3][i])
      const util = round((outstanding / c.credit_limit) * 100, 1)
      const overdue = [48, 6, 22, 0, 35, 12, 40, 0, 18, 4][i]
      const score = Math.min(100, Math.round(util * 0.5 + overdue * 0.8 + (i % 3) * 5))
      return { customerId: c.id, name: c.name, creditLimit: c.credit_limit, outstanding, utilizationPct: util, paymentTermDays: 30, weightedOverdueDays: overdue, outstanding30dAgo: Math.round(outstanding * 0.85), trend: i % 4 === 0 ? 'up' : i % 4 === 1 ? 'down' : i % 4 === 2 ? 'flat' : 'new', score, tier: score >= 65 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW', factors: { utilization: Math.round(util * 0.5), overdueSeverity: Math.round(overdue * 0.8), trend: (i % 3) * 5 } }
    }).sort((a, b) => b.score - a.score)
    return { rows, summary: { high: rows.filter(r => r.tier === 'HIGH').length, medium: rows.filter(r => r.tier === 'MEDIUM').length, low: rows.filter(r => r.tier === 'LOW').length, totalOutstanding: rows.reduce((s, r) => s + r.outstanding, 0) } }
  }],
  ['GET', '/reports/driver-scorecard', req => ({
    from: req.query.from, to: req.query.to,
    rows: D.DRIVERS.filter(d => !req.query.driver_type || d.driver_type === req.query.driver_type).map((d, i) => {
      const trips = D.CHALLANS.filter(c => c.driver_id === d.id && c.status !== 'DRAFT').length
      const qty = D.CHALLANS.filter(c => c.driver_id === d.id).reduce((s, c) => s + c.qty, 0)
      return { driverId: d.id, driverName: d.name, mobile: d.mobile, driverType: d.driver_type, trips, totalQtyCum: qty, totalDistanceKm: trips * (24 + i), distanceSampleSize: trips, avgQtyPerTrip: trips ? round(qty / trips, 1) : 0, avgDistancePerTrip: trips ? 24 + i : null, avgTurnaroundMinutes: trips ? 95 + i * 6 : null, turnaroundSampleSize: trips }
    }),
  })],
  ['GET', '/reports/gstr-summary', req => {
    const toRow = (i: any) => ({ invoiceNo: i.invoice_no, date: i.date, customerName: i.customer_name, gstin: i.customer_gstin, placeOfSupply: 'Karnataka (29)', taxableValue: i.subtotal, taxAmount: i.tax_amount, total: i.total_amount })
    const posted = D.INVOICES.filter(i => i.status === 'POSTED')
    const bucket = (rows: any[]) => ({ rows, taxableValue: rows.reduce((s, r) => s + r.taxableValue, 0), taxAmount: rows.reduce((s, r) => s + r.taxAmount, 0), total: rows.reduce((s, r) => s + r.total, 0) })
    const b2b = bucket(posted.filter(i => i.customer_gstin).map(toRow)), b2cs = bucket(posted.filter(i => !i.customer_gstin).map(toRow))
    return { month: req.query.month, b2b, b2cs, grandTotal: { taxableValue: b2b.taxableValue + b2cs.taxableValue, taxAmount: b2b.taxAmount + b2cs.taxAmount, total: b2b.total + b2cs.total } }
  }],
  ['GET', '/reports/multi-branch', () => {
    const s = dashboardSummary()
    const main = { branchId: D.BRANCH.id, branchName: D.BRANCH.name, city: D.BRANCH.city, todayQty: s.today.totalQty, todayTrips: s.today.totalTrips, monthQty: 3120, monthRevenue: 15912000, outstanding: s.finance.outstanding, qualityPassRate: s.quality.passRate }
    const north = { branchId: 'branch-north', branchName: 'Hebbal Plant', city: 'Bengaluru', todayQty: 94, todayTrips: 14, monthQty: 2240, monthRevenue: 11200000, outstanding: 2140000, qualityPassRate: 96.4 }
    const branches = [main, north]
    const sum = (k: keyof typeof main) => branches.reduce((a, b) => a + Number(b[k] ?? 0), 0)
    return { branches, totals: { todayQty: sum('todayQty'), todayTrips: sum('todayTrips'), monthQty: sum('monthQty'), monthRevenue: sum('monthRevenue'), outstanding: sum('outstanding') } }
  }],

  // Admin
  ['GET', '/audit/filters', () => ({ entityTypes: [...new Set(D.AUDIT.map(a => a.entity_type))], performers: [...new Set(D.AUDIT.map(a => a.performed_by))] })],
  ['GET', '/audit', req => list(D.AUDIT, req.query)],
  ['GET', '/admin/permissions/roles', () => permissionMatrix()],
  ['PUT', '/admin/permissions/roles', () => permissionMatrix()],
  ['GET', '/admin/permissions/users', () => D.USERS.map((u, i) => ({ id: u.id, name: u.name, email: u.email, role: u.role, overrideCount: i === 2 ? 2 : 0 }))],
  ['GET', '/admin/permissions/users/:id', (_r, p) => {
    const u = D.USERS.find(x => x.id === p.id) ?? notFound()
    const m = permissionMatrix()
    return { user: { id: u.id, name: u.name, email: u.email, role: u.role, overrideCount: 0 }, modules: m.modules.map(mod => { const def = u.role === 'ADMIN' || !!m.matrix[u.role]?.[mod.key]; return { ...mod, roleDefault: def, override: null, resolved: def } }) }
  }],
  ['PUT', '/admin/permissions/users/:id', () => ({ ok: true })],
  ['GET', '/admin/report-schedules/log', () => D.REPORT_LOG],
  ['GET', '/admin/report-schedules/preview', req => ({ content: req.query.report_type === 'VENDOR_ITEM' ? 'Vendor receipts — UltraTech Cement 48 t, Blue Metal 312 t, Local Quarry 220 t.' : `Dispatch digest — ${dashboardSummary().today.totalTrips} loads today, ${dashboardSummary().today.totalQty} m³, ₹${Math.round(dashboardSummary().today.totalRevenue).toLocaleString('en-IN')} billed.` })],
  ['POST', '/admin/report-schedules/:id/run-now', () => ({ ok: true })],
  ['GET', '/admin/report-schedules', () => D.REPORT_SCHEDULES], // a plain array, not a page
  ...crud('/admin/report-schedules', D.REPORT_SCHEDULES, { softDelete: false }),

  // Customer portal (portalApi)
  ['GET', '/portal/invoices', () => paginate(D.INVOICES.filter(i => i.customer_id === 'cust-1'), { limit: 50 })],
  ['GET', '/portal/statement', () => {
    let balance = 0
    const rows = [
      ...D.INVOICES.filter(i => i.customer_id === 'cust-1').map(i => ({ date: i.date, type: 'INVOICE', ref: i.invoice_no, debit: i.total_amount, credit: 0 })),
      ...D.RECEIPTS.filter(r => r.customer_id === 'cust-1').map(r => ({ date: r.date, type: 'RECEIPT', ref: r.number, debit: 0, credit: r.pay_amount })),
    ].sort((a, b) => a.date.localeCompare(b.date)).map(r => ({ ...r, balance: (balance += r.debit - r.credit) }))
    return { openingBalance: 0, rows, closingBalance: balance }
  }],
  ['GET', '/portal/deliveries', () => D.CHALLANS.filter(c => c.customer_id === 'cust-1' || c.customer_id === 'cust-11').map(c => ({ id: c.id, challan_no: c.challan_no, date: c.date, job_site: c.job_site, grade_name: c.grade_name, qty: c.qty, status: c.status, tracking_code: c.tracking_code }))],

  // Platform admin (platformApi)
  ['GET', '/platform/companies', () => D.COMPANIES],
  ['POST', '/platform/companies', req => ({ companyId: D.newId('co'), companyName: req.body?.companyName ?? req.body?.name ?? 'New company', companyCode: req.body?.companyCode ?? 'NEW', branchName: req.body?.branchName ?? 'Main Plant', branchCode: 'MAIN', adminEmail: req.body?.adminEmail ?? 'admin@example.in', wasExistingCompany: false })],
  ['PATCH', '/platform/companies/:id/active', (req, p) => Object.assign(D.COMPANIES.find(c => c.id === p.id) ?? notFound(), { is_active: !!req.body?.isActive })],
  ['PATCH', '/platform/companies/:id', (req, p) => Object.assign(D.COMPANIES.find(c => c.id === p.id) ?? notFound(), req.body)],

  // Public pages (bare axios, full /api/v1 path)
  ['GET', '/public/track/:code', (_r, p) => track(p.code)],
  ['GET', '/public/passport/:code', (_r, p) => {
    const c = track(p.code)
    const g = D.GRADES.find(x => x.grade_name === c.grade_name) ?? D.GRADES[4]
    const b = D.BATCHES.find(x => x.challan_id === c.id)
    return {
      challan: c,
      plant: { branch_name: D.BRANCH.name, branch_phone: D.BRANCH.phone, branch_city: D.BRANCH.city, branch_gstin: D.BRANCH.gstin, company_name: D.COMPANY.name, company_gstin: D.BRANCH.gstin, logo_url: null },
      grade: g,
      batch: b ? { batch_no: b.batch_no, batch_qty_cum: b.batch_qty_cum, status: b.status, source: b.source, started_at: b.created_at, completed_at: b.created_at, moisture_correction_pct: 3.2, water_added_extra_l: 0, materials: D.batchMaterials(g, num(b.batch_qty_cum), true) } : null,
      weighbridge: D.WEIGHBRIDGE.filter(w => w.challan_id === c.id),
      qualityTests: D.QUALITY_TESTS.filter(t => t.challan_id === c.id),
    }
  }],
]

function permissionMatrix() {
  const groups: [string, [string, string][]][] = [
    ['Dashboard', [['dashboard', 'Dashboard']]],
    ['Sales', [['sales.challans', 'Dispatch Challan'], ['sales.schedules', 'Daily Schedule'], ['sales.orders', 'Work Orders']]],
    ['Marketing', [['marketing.tenders', 'Tenders / RFQ'], ['marketing.quotations', 'Quotations']]],
    ['Finance', [['finance.invoices', 'Invoices'], ['finance.payments', 'Payment Voucher'], ['finance.receipts', 'Receipt Voucher'], ['finance.journals', 'Journal Entry'], ['finance.cashbook', 'Petty Cash']]],
    ['Stores', [['stores.po', 'Purchase Order'], ['stores.grn', 'GRN'], ['stores.indents', 'Indent'], ['stores.stock', 'Stock']]],
    ['Concrete Lab', [['lab.grades', 'Grade Master'], ['lab.tests', 'Cube Tests'], ['lab.ncr', 'NCR / CAPA']]],
    ['Production', [['production.batching', 'Batching'], ['production.weighbridge', 'Weighbridge'], ['production.oee', 'OEE']]],
    ['Fleet', [['fleet', 'Fleet & Tracking']]],
    ['Reports', [['reports.profitability', 'Profitability'], ['reports.aging', 'Aging'], ['reports.alerts', 'Alerts']]],
  ]
  const modules = groups.flatMap(([group, mods]) => mods.map(([key, label]) => ({ key, label, group })))
  const allow = (role: string, key: string) => role === 'MANAGER' ? !key.startsWith('admin') : role === 'OPERATOR' ? key === 'sales.challans' : key === 'dashboard' || key.startsWith('reports')
  const roles = ['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER']
  return { roles, modules, matrix: Object.fromEntries(roles.map(r => [r, Object.fromEntries(modules.map(m => [m.key, r === 'ADMIN' || allow(r, m.key)]))])) }
}

// ─── Matching ────────────────────────────────────────────────────────────
const compiled = ROUTES.map(([method, pattern, handler]) => ({
  method, handler, parts: pattern.split('/').filter(Boolean),
}))

/** The handler for a request, or null if no mock route matches. */
export function route(req: MockRequest): { handler: Handler; params: Record<string, string> } | null {
  const segs = req.path.split('/').filter(Boolean)
  for (const r of compiled) {
    if (r.method !== req.method || r.parts.length !== segs.length) continue
    const params: Record<string, string> = {}
    if (r.parts.every((p, i) => (p.startsWith(':') ? ((params[p.slice(1)] = decodeURIComponent(segs[i])), true) : p === segs[i]))) {
      return { handler: r.handler, params }
    }
  }
  return null
}
