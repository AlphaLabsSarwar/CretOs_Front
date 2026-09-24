// ─── Offline demo dataset ────────────────────────────────────────────────
// Seed records for offline UI mode (see lib/offline.ts): one ready-mix
// plant in Bengaluru with its customers, fleet, mix designs and a couple of
// weeks of dispatches. Everything is generated deterministically relative to
// *today*, so "today" views (dashboard, live tracking, batching) always have
// something happening. Records carry every field any screen reads — list
// columns, edit forms and print views alike — so one record serves them all.
/* eslint-disable @typescript-eslint/no-explicit-any */

// Deterministic PRNG so the demo looks the same on every reload.
let seed = 20260924
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]
const between = (a: number, b: number) => a + rand() * (b - a)
const int = (a: number, b: number) => Math.floor(between(a, b + 1))
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d
const pad = (n: number, w = 4) => String(n).padStart(w, '0')

const NOW = new Date()
export const now = () => new Date()
/** ISO timestamp `days` ago at hh:mm local time. */
export function at(days: number, hh = 10, mm = 0) {
  const d = new Date(NOW)
  d.setDate(d.getDate() - days)
  d.setHours(hh, mm, 0, 0)
  return d.toISOString()
}
export const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString()
/** Local calendar date (YYYY-MM-DD) — not the UTC date, which lags India's until 05:30. */
export const dateOnly = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}` }
let idSeq = 1000
export const newId = (prefix: string) => `${prefix}-${++idSeq}`

// ─── Company / branches ──────────────────────────────────────────────────
export const COMPANY = { id: 'offline-company', name: 'Demo RMC Pvt Ltd', code: 'DEMO' }
export const BRANCHES: any[] = [
  {
    id: 'offline-branch', name: 'Main Plant', code: 'MAIN', company_id: COMPANY.id,
    gstin: '29AADCD1234F1Z5', pan_no: 'AADCD1234F', address: 'Plot 42, KIADB Industrial Area, Whitefield',
    city: 'Bengaluru', state: 'Karnataka', pin_code: '560066', phone: '080 4123 5678', email: 'plant@demormc.in',
    bank_name: 'HDFC Bank', bank_branch: 'Whitefield', account_no: '50200012345678', ifsc_code: 'HDFC0001234',
    lat: 12.9698, lng: 77.75, rated_capacity_cum_hr: 60, operating_hours_per_day: 10,
    concrete_age_green_min: 60, concrete_age_yellow_min: 90, is_active: true,
  },
  {
    id: 'branch-north', name: 'Hebbal Plant', code: 'HBL', company_id: COMPANY.id,
    gstin: '29AADCD1234F2Z4', pan_no: 'AADCD1234F', address: 'Survey 18, Kodigehalli Main Road',
    city: 'Bengaluru', state: 'Karnataka', pin_code: '560092', phone: '080 4987 1122', email: 'hebbal@demormc.in',
    lat: 13.0358, lng: 77.597, rated_capacity_cum_hr: 45, operating_hours_per_day: 10, is_active: true,
  },
]
export const BRANCH = BRANCHES[0]
/** The branch_* columns print views join onto a record. */
export const branchFields = (b = BRANCH) => ({
  branch_id: b.id, branch_name: b.name, branch_code: b.code, branch_gstin: b.gstin, branch_pan_no: b.pan_no,
  branch_address: b.address, branch_city: b.city, branch_state: b.state, branch_pin_code: b.pin_code,
  branch_phone: b.phone, branch_email: b.email, branch_company_id: b.company_id,
  branch_bank_name: b.bank_name, branch_bank_branch: b.bank_branch, branch_account_no: b.account_no, branch_ifsc_code: b.ifsc_code,
})

// ─── Masters ─────────────────────────────────────────────────────────────
const CUSTOMER_SEED: [string, string, string, string, number, number][] = [
  // name, contact, job site, area, lat, lng
  ['Shree Constructions', 'Ramesh Iyer', 'Whitefield Site 2', 'Whitefield', 12.9855, 77.7361],
  ['Metro Builders', 'Anil Kapoor', 'Hebbal Towers', 'Hebbal', 13.0402, 77.5926],
  ['Nandi Infra', 'Suresh Gowda', 'Sarjapur Yard', 'Sarjapur', 12.8604, 77.7862],
  ['Vantage Realty', 'Priya Nair', 'HSR Layout Block 7', 'HSR Layout', 12.9116, 77.6474],
  ['Orion Developers', 'Karthik Rao', 'Marathahalli Mall', 'Marathahalli', 12.9591, 77.6974],
  ['Prestige Homes', 'Meera Pillai', 'Electronic City Ph 2', 'Electronic City', 12.8399, 77.677],
  ['Brigade Infra', 'Vikram Shetty', 'Yelahanka Phase 3', 'Yelahanka', 13.1007, 77.5963],
  ['Sobha Projects', 'Deepa Menon', 'KR Puram Flyover', 'KR Puram', 13.0075, 77.6959],
  ['GreenField Estates', 'Arjun Reddy', 'Hoskote Warehouse', 'Hoskote', 13.0707, 77.7982],
  ['Skyline Infratech', 'Neha Joshi', 'Bellandur Tech Park', 'Bellandur', 12.9304, 77.6784],
  ['Kaveri Contractors', 'Mahesh Kumar', 'Varthur Villas', 'Varthur', 12.9404, 77.7471],
  ['Apex Buildcon', 'Sanjay Verma', 'Hennur Main Road', 'Hennur', 13.0358, 77.6431],
]
export const CUSTOMERS: any[] = CUSTOMER_SEED.map(([name, contact, site, area, lat, lng], i) => {
  const creditLimit = [1500000, 2500000, 1000000, 800000, 3000000][i % 5]
  return {
    id: `cust-${i + 1}`, name, code: `C${pad(i + 1, 3)}`,
    gstin: i % 4 === 3 ? null : `29AAB${'CDEFGHIJKL'[i % 10]}${pad(1000 + i * 37, 4)}${'PQRST'[i % 5]}1Z${i % 9}`,
    pan_no: `AAB${'CDEFGHIJKL'[i % 10]}${pad(1000 + i * 37, 4)}P`,
    contact_person: contact, mobile: `98${pad(45000000 + i * 1234567, 8)}`, email: `${name.split(' ')[0].toLowerCase()}@example.in`,
    address: `${10 + i * 7}, ${area} Main Road`, city: 'Bengaluru', state: 'Karnataka', pin_code: `5600${pad(30 + i * 3, 2)}`,
    payment_term: pick(['Net 15', 'Net 30', 'Net 45']), credit_limit: creditLimit, opening_balance: 0,
    is_active: i !== 11, credit_hold: i === 4, credit_hold_reason: i === 4 ? 'Cheque bounced on 12 Sep — awaiting clearance' : null,
    portal_enabled: i < 3, portal_email: i < 3 ? `${name.split(' ')[0].toLowerCase()}@example.in` : null,
    job_site: site, lat, lng,
  }
})

const VENDOR_SEED: [string, string, string][] = [
  ['UltraTech Cement', 'MATERIAL', 'Cement'], ['JSW Cement', 'MATERIAL', 'GGBS'], ['Blue Metal Suppliers', 'MATERIAL', 'Aggregate'],
  ['Local Quarry Co.', 'MATERIAL', 'M-Sand'], ['Sika India', 'MATERIAL', 'Admixture'], ['Bharat Petroleum', 'SERVICE', 'Diesel'],
  ['Ashok Leyland Service', 'SERVICE', 'Fleet service'], ['Karnataka Transport Co.', 'TRANSPORTER', 'Transport'],
]
export const VENDORS: any[] = VENDOR_SEED.map(([name, type, supplies], i) => ({
  id: `vend-${i + 1}`, name, code: `V${pad(i + 1, 3)}`, vendor_type: type, supplies,
  gstin: `29AAC${'MNOPQRSTUV'[i]}${pad(2000 + i * 53, 4)}K1Z${i}`, pan_no: `AAC${'MNOPQRSTUV'[i]}${pad(2000 + i * 53, 4)}K`, tan_no: `BLR${pad(10000 + i * 7, 5)}E`,
  contact_person: pick(['Rajesh', 'Sunil', 'Anita', 'Farhan', 'Lakshmi', 'Gopal']) + ' ' + pick(['Sharma', 'Patel', 'Rao', 'Khan', 'Das']),
  designation: pick(['Sales Manager', 'Account Manager', 'Regional Head']),
  mobile: `97${pad(31000000 + i * 2345678, 8)}`, email: `${name.split(' ')[0].toLowerCase()}@supplier.in`,
  address: `${20 + i * 11}, Industrial Estate`, city: pick(['Bengaluru', 'Tumakuru', 'Hosur']), state: 'Karnataka', pin_code: `5620${pad(10 + i, 2)}`,
  bank_name: pick(['SBI', 'ICICI Bank', 'Axis Bank']), bank_branch: 'Main Branch', account_no: `3${pad(1234567890 + i * 97, 10)}`, ifsc_code: `SBIN000${pad(400 + i, 4)}`,
  payment_term: pick(['Net 15', 'Net 30']), credit_limit: 500000, opening_balance: 0, is_active: true,
  total_pos: int(3, 14), total_grns: int(2, 12), outstanding_amount: round(between(20000, 420000), 0),
}))

const GRADE_SEED: [string, number, number, number, number, number][] = [
  // name, cement, flyash/ggbs, 20mm, 10mm, water
  ['M10', 220, 0, 700, 450, 175], ['M15', 250, 50, 720, 430, 170], ['M20', 280, 60, 710, 420, 165],
  ['M25', 310, 70, 700, 410, 160], ['M30', 340, 75, 690, 400, 155], ['M35', 370, 80, 680, 390, 150], ['M40', 400, 90, 670, 380, 145],
]
export const GRADES: any[] = GRADE_SEED.map(([name, cement, scm, mm20, mm10, water], i) => ({
  id: `grade-${i + 1}`, grade_name: name, grade_code: `${name}-RMC`, comm_grade: `${name} Pump`, version: i === 4 ? 3 : 1 + (i % 2),
  cement_qty: cement, flyash_qty: i < 3 ? scm : null, ggbs_qty: i >= 3 ? scm : null,
  mm20_qty: mm20, mm10_qty: mm10, mm40_qty: null, csand_qty: 420 - i * 5, fsand_qty: 300 + i * 4,
  water_qty: water, admix_qty: round(2.4 + i * 0.3, 1), water_ratio: round(water / (cement + scm), 2),
  total_weight: cement + scm + mm20 + mm10 + 720 + water, cement_grade: 'OPC 53', admix_type: 'PCE', admix_name: 'Sika ViscoCrete',
  msa: '20mm', remarks: null, is_active: true, branch_id: BRANCH.id,
}))

export const ITEMS: any[] = [
  ['Cement OPC 53', 'cement', 'kg', '2523'], ['GGBS', 'ggbs', 'kg', '2618'], ['Fly Ash', 'flyash', 'kg', '2621'],
  ['Coarse Aggregate 20mm', 'mm20', 'kg', '2517'], ['Coarse Aggregate 10mm', 'mm10', 'kg', '2517'], ['M-Sand', 'csand', 'kg', '2505'],
  ['Fine Sand', 'fsand', 'kg', '2505'], ['Admixture PCE', 'admix', 'L', '3824'], ['Diesel', null, 'L', '2710'],
  ['Engine Oil 15W40', null, 'L', '2710'], ['Tyre 10.00R20', null, 'nos', '4011'], ['Ready Mix Concrete', null, 'cum', '3824'],
].map(([name, role, uom, hsn], i) => ({
  id: `item-${i + 1}`, item_no: `ITM-${pad(i + 1, 3)}`, name, short_name: (name as string).split(' ')[0], brand: i === 0 ? 'UltraTech' : i === 7 ? 'Sika' : null,
  item_type: i === 11 ? 'FINISHED_GOOD' : 'RAW_MATERIAL', item_group: role ? 'Raw Material' : 'Consumables', category: role ? 'Raw Material' : 'Consumables',
  uom, hsn_code: hsn, tax_type: 'GST 18%', material_role: role, for_stock: i !== 11, for_sale: i === 11, remarks: null, is_active: true,
}))

export const VEHICLES: any[] = Array.from({ length: 10 }, (_, i) => ({
  id: `veh-${i + 1}`, vehicle_no: `KA-0${1 + (i % 5)}-A${'BCDEFGHJKL'[i]}-${pad(1234 + i * 1111, 4)}`,
  vehicle_type: i < 7 ? 'TRANSIT_MIXER' : i === 7 ? 'PUMP' : 'TIPPER',
  capacity: i < 7 ? [6, 7, 8][i % 3] : i === 7 ? null : 10, owner_name: i < 6 ? 'Self' : pick(['Karnataka Transport Co.', 'Ravi Transports']),
  mobile: `99${pad(20000000 + i * 3456789, 8)}`, is_active: true, branch_id: BRANCH.id,
}))

const DRIVER_NAMES = ['Manoj Kumar', 'Suresh P.', 'Imran Khan', 'Naveen R.', 'Ali Hussain', 'Ganesh T.', 'Ravi Shankar', 'Prakash M.', 'Deepak Singh', 'Venkatesh B.']
export const DRIVERS: any[] = DRIVER_NAMES.map((name, i) => ({
  id: `drv-${i + 1}`, name, mobile: `98${pad(70000000 + i * 1357913, 8)}`, license_no: `KA0${1 + (i % 5)}${pad(2015 + (i % 8), 4)}${pad(100000 + i * 777, 7)}`,
  driver_type: i < 8 ? 'DRIVER' : 'OPERATOR', is_active: true, app_enabled: i < 6, address: 'Bengaluru', branch_id: BRANCH.id,
}))

export const USERS: any[] = [
  ['Demo Admin', 'demo@cretos.local', 'ADMIN'], ['Rahul Siwal', 'rahul@demormc.in', 'ADMIN'], ['Priya Menon', 'priya@demormc.in', 'MANAGER'],
  ['Kiran Desai', 'kiran@demormc.in', 'MANAGER'], ['Loading Bay Operator', 'operator@demormc.in', 'OPERATOR'], ['Accounts Viewer', 'accounts@demormc.in', 'VIEWER'],
].map(([name, email, role], i) => ({
  id: i === 0 ? 'offline-user' : `user-${i + 1}`, name, email, role, is_active: true,
  branch_id: i === 3 ? 'branch-north' : BRANCH.id, branch_name: i === 3 ? 'Hebbal Plant' : 'Main Plant',
}))

export const PUMPS: any[] = [
  ['BP-01', 'BOOM', 90, 'OWNED', 'Ganesh T.'], ['BP-02', 'BOOM', 90, 'OWNED', 'Venkatesh B.'],
  ['LP-01', 'LINE', 45, 'OWNED', 'Prakash M.'], ['LP-02', 'LINE', 40, 'HIRED', 'Hired operator'],
].map(([no, type, cap, own, op], i) => ({
  id: `pump-${i + 1}`, pump_no: no, pump_type: type, capacity_cum_hr: cap, ownership: own, operator_name: op,
  mobile: `96${pad(11000000 + i * 2222222, 8)}`, is_active: true, branch_id: BRANCH.id,
}))

export const CUSTOMER_RATES: any[] = CUSTOMERS.slice(0, 8).flatMap((c, i) =>
  [GRADES[3 + (i % 3)], GRADES[2 + (i % 2)]].map((g, j) => ({
    id: `rate-${i}-${j}`, customer_id: c.id, customer_name: c.name, grade_name: g.grade_name,
    rate: 4200 + GRADES.indexOf(g) * 350 + (i % 3) * 100, is_active: true, remarks: j === 0 ? 'FY 26-27 contract' : null,
  })))

// ─── Sales: challans (the backbone most screens derive from) ─────────────
const custById = (id: string) => CUSTOMERS.find(c => c.id === id)!
export const customerFields = (c: any) => ({
  customer_id: c.id, customer_name: c.name, customer_mobile: c.mobile, customer_gstin: c.gstin,
  customer_address: c.address, customer_city: c.city, customer_state: c.state,
})

function makeChallan(n: number, days: number, hh: number, mm: number, state: 'DRAFT' | 'ON_ROAD' | 'AT_SITE' | 'DELIVERED') {
  const c = CUSTOMERS[n % 10]
  const g = GRADES[2 + (n % 5)]
  const v = VEHICLES[n % 7]
  const d = DRIVERS[n % 8]
  const qty = [6, 7, 8, 6, 7][n % 5]
  const rate = 4200 + GRADES.indexOf(g) * 350
  const dispatch = at(days, hh, mm)
  const dispatchMs = new Date(dispatch).getTime()
  const travel = int(28, 55)
  const siteIn = state === 'AT_SITE' || state === 'DELIVERED' ? new Date(dispatchMs + travel * 60_000).toISOString() : null
  const siteOut = state === 'DELIVERED' ? new Date(dispatchMs + (travel + int(35, 60)) * 60_000).toISOString() : null
  const subtotal = qty * rate
  return {
    id: `ch-${n}`, challan_no: `CH-${10200 + n}`, date: dateOnly(dispatch), serial_no: String(n),
    ...customerFields(c), job_site: c.job_site, job_site_lat: c.lat, job_site_lng: c.lng,
    grade_id: g.id, grade_name: g.grade_name, grade_code: g.grade_code, qty, act_qty: qty, rate, subtotal,
    toll_tax: 0, invoice_total: round(subtotal * 1.18), tax_type: 'GST',
    vehicle_id: v.id, vehicle_no: v.vehicle_no, vehicle_type: v.vehicle_type,
    driver_id: d.id, driver_name: d.name, driver_mobile: d.mobile, driver_license_no: d.license_no,
    helper: pick(['Ravi S.', 'Anil K.', null]), pump_type: n % 3 === 0 ? 'WITH_PUMP' : 'WITHOUT_PUMP', pump_no: n % 3 === 0 ? 'BP-01' : null,
    start_km: 1000 + n * 37, end_km: siteOut ? 1000 + n * 37 + int(18, 42) : null, distance: siteOut ? int(18, 42) : null,
    slump: int(95, 125), batch_no: `B-${4400 + n}`, order_no: `SO-${pad(300 + (n % 9), 4)}`,
    dispatch_time: dispatch, site_in: siteIn, site_out: siteOut,
    // Real API statuses: DRAFT until posted, then ACTIVE; delivery is site_out, billing is `invoiced`.
    status: state === 'DRAFT' ? 'DRAFT' : 'ACTIVE',
    remarks: null, tracking_code: `TRK${pad(52000 + n * 7, 6)}`, invoiced: state === 'DELIVERED' && days > 3,
    eta: state === 'ON_ROAD' ? { etaAt: new Date(dispatchMs + travel * 60_000).toISOString(), travelMinutes: Math.max(4, Math.round((dispatchMs + travel * 60_000 - Date.now()) / 60_000)), distanceKm: int(12, 26) } : null,
    created_at: dispatch, ...branchFields(),
  }
}

export const CHALLANS: any[] = (() => {
  const out: any[] = []
  let n = 1
  // 45 days of history: 3–6 deliveries a day in the last fortnight, 2–3 before.
  for (let day = 45; day >= 1; day--) {
    const count = day > 14 ? int(2, 3) : int(3, 6)
    for (let k = 0; k < count; k++) out.push(makeChallan(n++, day, 8 + k * 2, int(0, 50), 'DELIVERED'))
  }
  // Today: finished runs, trucks at site, trucks on the road, a draft.
  const h = NOW.getHours()
  const sinceMidnight = h * 60 + NOW.getMinutes()
  const fresh = (mins: number, state: 'ON_ROAD' | 'AT_SITE' | 'DELIVERED') => {
    const t = new Date(NOW.getTime() - Math.min(mins, sinceMidnight - 1) * 60_000)
    return makeChallan(n++, 0, t.getHours(), t.getMinutes(), state)
  }
  for (const mins of [330, 270, 210]) if (mins < sinceMidnight) out.push(fresh(mins, 'DELIVERED'))
  out.push(fresh(75, 'AT_SITE'))
  out.push(fresh(58, 'AT_SITE'))
  out.push(fresh(34, 'ON_ROAD'))
  out.push(fresh(21, 'ON_ROAD'))
  out.push(fresh(9, 'ON_ROAD'))
  out.push(makeChallan(n++, 0, h, 0, 'DRAFT'))
  return out.reverse()
})()

// Live GPS for trucks still out: somewhere between the plant and the site.
export function liveRows() {
  return CHALLANS.filter(c => c.status === 'ACTIVE' && !c.site_out).map((c, i) => {
    const elapsed = (Date.now() - new Date(c.dispatch_time).getTime()) / 60_000
    const progress = c.site_in ? 1 : Math.min(0.92, elapsed / 45)
    const lat = BRANCH.lat + (c.job_site_lat - BRANCH.lat) * progress
    const lng = BRANCH.lng + (c.job_site_lng - BRANCH.lng) * progress
    return {
      id: c.id, challanNo: c.challan_no, jobSite: c.job_site, gradeName: c.grade_name, qty: c.qty,
      dispatchTime: c.dispatch_time, siteIn: c.site_in, jobSiteLat: c.job_site_lat, jobSiteLng: c.job_site_lng,
      driverLat: round(lat, 5), driverLng: round(lng, 5), driverLocationAt: minutesAgo(i === 1 ? 9 : 1),
      customerName: c.customer_name, vehicleNo: c.vehicle_no, driverName: c.driver_name,
    }
  })
}

// ─── Marketing ───────────────────────────────────────────────────────────
const TENDER_STATUSES = ['NEW', 'NEW', 'IN_REVIEW', 'IN_REVIEW', 'QUOTED', 'WON', 'LOST', 'NEW', 'IN_REVIEW', 'WON']
export const TENDERS: any[] = TENDER_STATUSES.map((status, i) => {
  const c = CUSTOMERS[(i + 2) % 12]
  return {
    id: `tender-${i + 1}`, tender_no: `TND-${pad(140 + i, 4)}`, date: dateOnly(at(20 - i * 2)),
    customer_id: i % 3 === 0 ? null : c.id, customer_name: i % 3 === 0 ? pick(['Lodha Group', 'Godrej Properties', 'Embassy Builders', 'Salarpuria Sattva']) : c.name,
    contact_person: c.contact_person, mobile: c.mobile, email: c.email, project_site: `${c.job_site.split(' ')[0]} ${pick(['Residency', 'Tech Park', 'Villas', 'Tower B'])}`,
    source: pick(['REFERRAL', 'REPEAT_CUSTOMER', 'WEBSITE', 'GOVT_TENDER', 'SITE_VISIT']),
    scope_description: 'Supply of RMC for slab and column work, pump required above 4th floor.',
    estimated_qty: int(4, 30) * 50, grade_requirement: pick(['M-25', 'M-30', 'M-35']),
    submission_deadline: dateOnly(at(-int(2, 20))), estimated_value: int(8, 90) * 100000,
    status, lost_reason: status === 'LOST' ? 'Price — competitor quoted ₹180/cum lower' : null, remarks: null,
  }
})

export const QUOTATIONS: any[] = Array.from({ length: 9 }, (_, i) => {
  const c = CUSTOMERS[i % 10]
  return {
    id: `quot-${i + 1}`, quot_no: `QT-${pad(560 + i, 4)}`, date: dateOnly(at(25 - i * 3)), valid_date: dateOnly(at(-10 + i)),
    ...customerFields(c), project_site: c.job_site, address: c.address, inquiry_no: `INQ-${pad(80 + i, 3)}`, ref_no: `REF/${2026}/${pad(i + 1, 3)}`,
    kind_attn: c.contact_person, mobile: c.mobile, email: c.email, heading: `Quotation for RMC supply — ${c.job_site}`,
    remarks: 'Rates exclusive of pumping charges. Valid for 30 days.', status: ['ACTIVE', 'ACTIVE', 'DRAFT', 'ACTIVE', 'CLOSED'][i % 5],
    ...branchFields(),
  }
})

export const ORDERS: any[] = Array.from({ length: 9 }, (_, i) => {
  const c = CUSTOMERS[i % 10]
  return {
    id: `order-${i + 1}`, order_no: `SO-${pad(300 + i, 4)}`, date: dateOnly(at(30 - i * 3)), ...customerFields(c), job_site: c.job_site,
    sales_type: pick(['RMC SALE', 'RATE CONTRACT']), tax_type: 'GST', quotation_no: QUOTATIONS[i % 9].quot_no, po_no: `PO/${c.code}/${pad(i + 11, 3)}`,
    po_date: dateOnly(at(32 - i * 3)), deli_date: dateOnly(at(-3)), from_date: dateOnly(at(30 - i * 3)), to_date: dateOnly(at(-30 + i)),
    currency: 'INR', remarks: null, status: i === 7 ? 'DRAFT' : i === 8 ? 'CLOSED' : 'ACTIVE',
  }
})

export const SCHEDULES: any[] = Array.from({ length: 10 }, (_, i) => {
  const c = CUSTOMERS[i % 10]
  const g = GRADES[2 + (i % 5)]
  return {
    id: `sch-${i + 1}`, sch_no: `SCH-${pad(700 + i, 4)}`, date: dateOnly(at(i < 6 ? 0 : -1)), ...customerFields(c), order_id: ORDERS[i % 7].id,
    job_site: c.job_site, grade_name: g.grade_name, qty: int(3, 12) * 6, pump_type: i % 2 ? 'WITH_PUMP' : 'WITHOUT_PUMP', pump_name: i % 2 ? 'BP-01' : null,
    start_time: `${pad(8 + i, 2)}:00`, end_time: `${pad(11 + i, 2)}:00`, rate: 4200 + GRADES.indexOf(g) * 350,
    supervisor: 'Kiran Desai', mkt_user: 'Priya Menon', remarks: null, status: i === 9 ? 'DRAFT' : 'ACTIVE',
  }
})

// ─── Finance ─────────────────────────────────────────────────────────────
export const INVOICES: any[] = (() => {
  const delivered = CHALLANS.filter(c => c.invoiced)
  const byCustomer = new Map<string, any[]>()
  for (const c of delivered) byCustomer.set(c.customer_id, [...(byCustomer.get(c.customer_id) ?? []), c])
  let n = 0
  return [...byCustomer.values()].flatMap(list => {
    const chunks = [list.slice(0, Math.ceil(list.length / 2)), list.slice(Math.ceil(list.length / 2))].filter(x => x.length)
    return chunks.map(chs => {
      n++
      const subtotal = chs.reduce((s, c) => s + c.subtotal, 0)
      const tax = round(subtotal * 0.18)
      const c = custById(chs[0].customer_id)
      const date = chs[chs.length - 1].date
      return {
        id: `inv-${n}`, invoice_no: `INV-${3300 + n}`, date, ...customerFields(c), tax_type: 'GST',
        subtotal, cgst: round(tax / 2), sgst: round(tax / 2), igst: 0, tax_amount: tax, total_amount: round(subtotal + tax),
        status: n % 5 === 0 ? 'PENDING_APPROVAL' : n % 7 === 0 ? 'DRAFT' : 'POSTED', remarks: null,
        irn: n % 3 === 0 ? `IRN${pad(n * 7919, 10)}` : null, ack_no: n % 3 === 0 ? `1120${pad(n * 131, 8)}` : null, ack_date: n % 3 === 0 ? date : null,
        signed_qr_code: null, eway_bill_no: null, eway_bill_date: null,
        items: chs.map(ch => ({
          id: `ii-${ch.id}`, description: `Ready Mix Concrete ${ch.grade_name}`, qty: ch.qty, rate: ch.rate, amount: ch.subtotal,
          challan_no: ch.challan_no, challan_date: ch.date, grade_name: ch.grade_name, pump_type: ch.pump_type, job_site: ch.job_site,
          vehicle_no: ch.vehicle_no, driver_name: ch.driver_name, hsn_code: '3824', po_no: `PO/${c.code}/011`, po_date: dateOnly(at(30)),
        })),
        ...branchFields(),
      }
    })
  })
})()

export const PAYMENTS: any[] = Array.from({ length: 9 }, (_, i) => {
  const v = VENDORS[i % 8]
  return {
    id: `pay-${i + 1}`, number: `PV-${pad(410 + i, 4)}`, date: dateOnly(at(i * 3 + 1)), vendor_id: v.id, vendor_name: v.name,
    ledger_name: v.vendor_type === 'SERVICE' ? 'Repairs & Maintenance' : 'Purchase — Raw Material', pay_amount: int(4, 60) * 5000,
    trans_type: pick(['NEFT', 'RTGS', 'CHEQUE', 'UPI', 'CASH']), ref_no: `UTR${pad(88000 + i * 97, 8)}`, ref_date: dateOnly(at(i * 3 + 1)),
    cheque_no: null, instr_date: null, bank_date: null, bank_name: 'HDFC Bank', print_name: v.name, remarks: null,
    status: i === 8 ? 'DRAFT' : 'POSTED',
  }
})

export const RECEIPTS: any[] = Array.from({ length: 10 }, (_, i) => {
  const c = CUSTOMERS[i % 10]
  return {
    id: `rec-${i + 1}`, number: `RV-${pad(820 + i, 4)}`, date: dateOnly(at(i * 2)), ...customerFields(c),
    ledger_name: 'Sundry Debtors', pay_amount: int(6, 50) * 10000, trans_type: pick(['NEFT', 'RTGS', 'CHEQUE', 'UPI']),
    ref_no: `UTR${pad(55000 + i * 131, 8)}`, ref_date: dateOnly(at(i * 2)), cheque_no: null, bank_name: 'HDFC Bank',
    tds_amount: i % 4 === 0 ? 2000 : 0, remarks: null, status: i === 9 ? 'DRAFT' : 'POSTED',
  }
})

export const JOURNALS: any[] = [
  ['Depreciation — Plant & Machinery', 84000], ['Provision for Audit Fees', 45000], ['Prepaid Insurance Adjustment', 36000],
  ['Salary Payable', 612000], ['Diesel Stock Adjustment', 18500], ['GST Input Reversal', 7400],
].map(([ledger, amt], i) => ({
  id: `jv-${i + 1}`, number: `JV-${pad(90 + i, 4)}`, date: dateOnly(at(i * 5 + 2)), ledger_name: ledger, pay_amount: amt,
  trans_type: 'JOURNAL', ref_no: `JV/${pad(i + 1, 3)}`, remarks: 'Month-end entry', status: i === 5 ? 'DRAFT' : 'POSTED',
}))

// ─── Stores ──────────────────────────────────────────────────────────────
export const POS: any[] = Array.from({ length: 9 }, (_, i) => {
  const v = VENDORS[i % 6]
  const sub = int(8, 80) * 10000
  return {
    id: `po-${i + 1}`, po_no: `PO-${pad(1200 + i, 4)}`, date: dateOnly(at(i * 4 + 1)), vendor_id: v.id, vendor_name: v.name,
    vendor_gstin: v.gstin, vendor_pan_no: v.pan_no, vendor_address: v.address, vendor_city: v.city, vendor_state: v.state, vendor_mobile: v.mobile, vendor_email: v.email,
    po_type: pick(['MATERIAL', 'MATERIAL', 'SERVICE']), tax_type: 'GST', ref_no: `QTN/${v.code}/${pad(i + 1, 3)}`, valid_date: dateOnly(at(-30 + i)),
    payment_term: pick(['Net 15', 'Net 30']), currency: 'INR', del_address: BRANCH.address, sub_total: sub, total_amount: round(sub * 1.18),
    remarks: null, status: ['ACTIVE', 'PENDING_APPROVAL', 'DRAFT', 'ACTIVE', 'CLOSED'][i % 5], ...branchFields(),
  }
})

export const GRNS: any[] = Array.from({ length: 9 }, (_, i) => {
  const po = POS[i % 9]
  const v = VENDORS.find(x => x.id === po.vendor_id)!
  const gross = int(28000, 42000)
  const tare = int(11000, 14000)
  return {
    id: `grn-${i + 1}`, number: `GRN-${pad(2300 + i, 4)}`, date: dateOnly(at(i * 2)), vendor_id: v.id, vendor_name: v.name,
    vendor_gstin: v.gstin, vendor_address: v.address, vendor_city: v.city, vendor_state: v.state, vendor_mobile: v.mobile,
    po_id: po.id, po_no: po.po_no, grn_type: 'MATERIAL', party_challan_no: `DC-${pad(7700 + i * 13, 5)}`, challan_date: dateOnly(at(i * 2)),
    royalty_pass_no: `RP${pad(4400 + i, 6)}`, vehicle_no: `KA-0${2 + (i % 4)}-C${'DEFGHJ'[i % 6]}-${pad(3300 + i * 7, 4)}`,
    gate_entry_no: `GE-${pad(510 + i, 4)}`, godown: 'Main Yard', wb_no: `WB-${pad(6100 + i, 5)}`,
    total_qty: round((gross - tare) / 1000, 2), total_amount: round(((gross - tare) / 1000) * pick([640, 720, 5400]), 0),
    gross_weight: gross, tare_weight: tare, net_weight: gross - tare, remarks: null, status: i === 8 ? 'DRAFT' : 'POSTED', ...branchFields(),
  }
})

export const INDENTS: any[] = [
  ['Maintenance', 42000], ['Production', 180000], ['Quality Lab', 26000], ['Fleet', 64000], ['Admin', 12000], ['Production', 95000],
].map(([dept, total], i) => ({
  id: `ind-${i + 1}`, indent_no: `IND-${pad(330 + i, 4)}`, date: dateOnly(at(i * 3 + 1)), dept_name: dept, total, doc_close: i > 3,
  remarks: null, status: i > 3 ? 'CLOSED' : i === 0 ? 'DRAFT' : 'ACTIVE',
}))

export const STOCK: any[] = [
  ['cement', 'Cement (OPC 53)', 'kg', 184000, 150000, 7.1], ['ggbs', 'GGBS', 'kg', 42000, 40000, 3.8], ['flyash', 'Fly Ash', 'kg', 21000, 30000, 2.6],
  ['mm20', 'Coarse Aggregate 20mm', 'kg', 610000, 500000, 0.7], ['mm10', 'Coarse Aggregate 10mm', 'kg', 280000, 350000, 0.72],
  ['csand', 'M-Sand', 'kg', 520000, 400000, 0.8], ['fsand', 'Fine Sand', 'kg', 190000, 150000, 0.95], ['admix', 'Admixture (PCE)', 'L', 1450, 1200, 92],
].map(([material, label, uom, qty, reorder, cost], i) => ({
  material, label, uom, itemId: ITEMS[i]?.id ?? null, unassigned: false, qty_on_hand: qty, reorder_level: reorder, avg_cost: cost, low: (qty as number) < (reorder as number),
}))

// ─── Production ──────────────────────────────────────────────────────────
const MATERIAL_KEYS: [string, string, string, number][] = [
  ['cement', 'Cement', 'kg', 7.1], ['ggbs', 'GGBS', 'kg', 3.8], ['mm20', 'Aggregate 20mm', 'kg', 0.7], ['mm10', 'Aggregate 10mm', 'kg', 0.72],
  ['csand', 'M-Sand', 'kg', 0.8], ['water', 'Water', 'L', 0.05], ['admix', 'Admixture', 'L', 92],
]
export function batchMaterials(grade: any, qty: number, done: boolean, progress = 1) {
  const per: Record<string, number> = {
    cement: grade.cement_qty, ggbs: grade.ggbs_qty ?? grade.flyash_qty ?? 0, mm20: grade.mm20_qty, mm10: grade.mm10_qty,
    csand: grade.csand_qty + grade.fsand_qty, water: grade.water_qty, admix: grade.admix_qty,
  }
  return MATERIAL_KEYS.map(([key, label, uom, cost], i) => {
    const target = round(per[key] * qty, 1)
    const actual = done ? round(target * (1 + between(-0.02, 0.025)), 1) : progress > i / MATERIAL_KEYS.length ? round(target * Math.min(1, progress * 1.1), 1) : null
    const variance = actual == null ? null : round(actual - target, 1)
    return { id: `bm-${key}`, material_key: key, label, uom, target_qty: target, actual_qty: actual, variance_qty: variance, unit_cost: cost, variance_cost: variance == null ? null : round(variance * cost, 0) }
  })
}
export const BATCHES: any[] = (() => {
  const today = CHALLANS.filter(c => c.date === dateOnly(NOW.toISOString()) && c.status !== 'DRAFT')
  const past = CHALLANS.filter(c => c.date !== dateOnly(NOW.toISOString())).slice(0, 10)
  const rows: any[] = [...today, ...past].map((c, i) => {
    const g = GRADES.find(x => x.grade_name === c.grade_name)!
    const created = new Date(new Date(c.dispatch_time).getTime() - 18 * 60_000).toISOString()
    return {
      id: `batch-${i + 1}`, batch_no: c.batch_no, grade_id: g.id, grade_name: g.grade_name, grade_version: g.version,
      batch_qty_cum: c.qty, status: 'COMPLETED', source: i % 4 === 0 ? 'MANUAL' : 'PLC', sync_status: i === 3 ? 'PENDING' : i === 6 ? 'FAILED' : 'SYNCED',
      plc_batch_ref: `PLC-${pad(88000 + i, 6)}`, mixer_no: pick(['Mixer A', 'Mixer B']), operator: pick(['Shankar', 'Ramu', 'Vinod']),
      remarks: null, challan_id: c.id, challan_no: c.challan_no, job_site: c.job_site, customer_name: c.customer_name, created_at: created,
    }
  })
  // One running and two queued for right now.
  const g = GRADES[4]
  rows.unshift(
    { id: 'batch-live', batch_no: `B-${4400 + CHALLANS.length + 1}`, grade_id: g.id, grade_name: g.grade_name, grade_version: g.version, batch_qty_cum: 8, status: 'BATCHING', source: 'PLC', sync_status: 'SYNCED', plc_batch_ref: 'PLC-099001', mixer_no: 'Mixer B', operator: 'Shankar', remarks: null, challan_id: null, challan_no: null, job_site: CUSTOMERS[0].job_site, customer_name: CUSTOMERS[0].name, created_at: minutesAgo(6) },
    { id: 'batch-next-1', batch_no: `B-${4400 + CHALLANS.length + 2}`, grade_id: GRADES[3].id, grade_name: 'M25', grade_version: 1, batch_qty_cum: 6, status: 'REQUESTED', source: 'MANUAL', sync_status: 'PENDING', plc_batch_ref: null, mixer_no: 'Mixer A', operator: 'Ramu', remarks: null, challan_id: null, challan_no: null, job_site: CUSTOMERS[2].job_site, customer_name: CUSTOMERS[2].name, created_at: minutesAgo(2) },
  )
  return rows
})()

export const WEIGHBRIDGE: any[] = Array.from({ length: 12 }, (_, i) => {
  const inward = i % 3 === 2
  const gross = inward ? int(30000, 42000) : int(24000, 31000)
  const tare = inward ? int(11000, 14000) : int(12000, 13500)
  const open = i === 0
  const c = CHALLANS[i + 1]
  return {
    id: `wb-${i + 1}`, ticket_no: `WB-${pad(6200 + i, 5)}`, ticket_type: inward ? 'INWARD_MATERIAL' : 'OUTWARD_RMC',
    status: open ? 'GROSS_CAPTURED' : 'COMPLETED', vehicle_id: inward ? null : c.vehicle_id, vehicle_no: inward ? null : c.vehicle_no,
    vehicle_no_manual: inward ? GRNS[i % 9].vehicle_no : null, driver_id: inward ? null : c.driver_id, driver_name: inward ? null : c.driver_name,
    challan_id: inward ? null : c.id, challan_no: inward ? null : c.challan_no, material_desc: inward ? pick(['Aggregate 20mm', 'M-Sand', 'Cement bulker']) : 'RMC',
    gross_weight: gross, gross_time: minutesAgo(i * 95 + 20), tare_weight: open ? null : tare, tare_time: open ? null : minutesAgo(i * 95), net_weight: open ? null : gross - tare,
    remarks: null, created_at: minutesAgo(i * 95 + 25),
  }
})

// ─── Quality ─────────────────────────────────────────────────────────────
export const QUALITY_TESTS: any[] = CHALLANS.filter((c, k) => c.status !== 'DRAFT' && k % 3 === 0).slice(0, 48).map((c, i) => {
  const g = GRADES.find(x => x.grade_name === c.grade_name)!
  const target = Number(g.grade_name.slice(1))
  const age = i % 3 === 0 ? 7 : 28
  const castDays = Math.round((NOW.getTime() - new Date(c.dispatch_time).getTime()) / 86_400_000)
  const pending = castDays < age
  const fail = !pending && i % 9 === 4
  const actual = pending ? null : round(age === 7 ? target * between(0.66, 0.74) : fail ? target * between(0.86, 0.94) : target * between(1.02, 1.14), 1)
  return {
    id: `qt-${i + 1}`, challan_id: c.id, challan_no: c.challan_no, customer_name: c.customer_name, job_site: c.job_site, grade_name: c.grade_name,
    cast_date: c.date, test_date: pending ? null : dateOnly(new Date(new Date(c.dispatch_time).getTime() + age * 86_400_000).toISOString()),
    age_days: age, cube_id: `CB-${1180 + i}`, target_strength: age === 7 ? round(target * 0.67, 1) : target, actual_strength: actual,
    result: pending ? 'PENDING' : fail ? 'FAIL' : 'PASS', remarks: fail ? 'Low strength — flagged for review' : null, ...branchFields(),
  }
})

export const NCRS: any[] = [
  ['CUBE_FAILURE', 'HIGH', 'M30 cube CB-1184 failed 28-day test at 27.1 MPa (target 30).', 'OPEN'],
  ['CUSTOMER_COMPLAINT', 'MEDIUM', 'Slump loss reported at Hebbal Towers after 70 min transit.', 'ROOT_CAUSE'],
  ['BATCH_DEVIATION', 'LOW', 'Water +8% over plan on batch B-4470.', 'CORRECTIVE_ACTION'],
  ['MATERIAL', 'MEDIUM', '20mm aggregate from Blue Metal Suppliers above silt limit.', 'VERIFICATION'],
  ['CUBE_FAILURE', 'HIGH', 'M35 cube CB-1161 failed 7-day indicative test.', 'CLOSED'],
].map(([source, severity, description, status], i) => ({
  id: `ncr-${i + 1}`, ncr_no: `NCR-${pad(40 + i, 4)}`, source_type: source, severity, description, status,
  root_cause: i > 0 ? 'Extended transit time in afternoon traffic; admixture dosage not adjusted.' : null,
  corrective_action: i > 1 ? 'Increase PCE dosage 0.2% for runs over 45 min.' : null, preventive_action: i > 2 ? 'Dispatch planner flags long routes before batching.' : null,
  raised_by: 'Priya Menon', assigned_to: 'Kiran Desai', target_close_date: dateOnly(at(-7 + i * 2)),
  approved_by: i > 2 ? 'Rahul Siwal' : null, approved_at: i > 2 ? at(3) : null, verified_by: i > 3 ? 'Rahul Siwal' : null, verified_at: i > 3 ? at(1) : null,
  closed_at: status === 'CLOSED' ? at(1) : null, created_at: at(12 - i * 2),
}))

// ─── Fleet ───────────────────────────────────────────────────────────────
export const MAINTENANCE: any[] = VEHICLES.slice(0, 8).flatMap((v, i) => [
  { id: `mnt-${i}-a`, vehicle_id: v.id, vehicle_no: v.vehicle_no, service_type: 'Oil & filter change', service_date: dateOnly(at(40 + i * 3)), odometer: 41000 + i * 2300, cost: 8400, vendor_name: 'Ashok Leyland Service', next_due_date: dateOnly(at(i === 2 ? 3 : -(20 + i * 4))), remarks: null },
  ...(i % 2 === 0 ? [{ id: `mnt-${i}-b`, vehicle_id: v.id, vehicle_no: v.vehicle_no, service_type: 'Drum bearing inspection', service_date: dateOnly(at(95 + i)), odometer: 36000 + i * 2100, cost: 14500, vendor_name: 'Ashok Leyland Service', next_due_date: null, remarks: null }] : []),
])
export const FUEL: any[] = VEHICLES.slice(0, 8).flatMap((v, i) => [0, 1].map(k => ({
  id: `fuel-${i}-${k}`, vehicle_id: v.id, vehicle_no: v.vehicle_no, fill_date: dateOnly(at(k * 9 + i)), odometer: 42000 + i * 2300 + k * 400,
  litres: int(90, 180), rate: 89.6, amount: 0, filled_by: pick(['Plant pump', 'BPCL Whitefield']),
}))).map(f => ({ ...f, amount: round(f.litres * f.rate, 0) }))

// ─── Admin ───────────────────────────────────────────────────────────────
export const AUDIT: any[] = Array.from({ length: 36 }, (_, i) => {
  const [entity, label, action, summary] = pick([
    ['CHALLAN', () => CHALLANS[i % 20].challan_no, 'CREATE', 'Dispatch challan created'],
    ['CHALLAN', () => CHALLANS[i % 20].challan_no, 'UPDATE', 'Marked delivered at site'],
    ['INVOICE', () => INVOICES[i % INVOICES.length].invoice_no, 'APPROVE', 'Invoice approved and posted'],
    ['CUSTOMER', () => CUSTOMERS[i % 12].name, 'UPDATE', 'Credit limit changed'],
    ['GRADE', () => GRADES[i % 7].grade_name, 'UPDATE', 'Mix design revised to new version'],
    ['USER', () => USERS[i % 6].name, 'LOGIN', 'Signed in'],
  ] as [string, () => string, string, string][])
  return {
    id: `audit-${i + 1}`, entity_type: entity, entity_id: null, entity_label: label(), action, summary,
    performed_by: pick(['Demo Admin', 'Rahul Siwal', 'Priya Menon', 'Kiran Desai']), created_at: minutesAgo(i * 47 + 3),
  }
})

export const REPORT_SCHEDULES: any[] = [
  { id: 'rs-1', report_type: 'DISPATCH_DIGEST', time_of_day: '19:00', recipient_mobile: '9845012345', channels: ['WHATSAPP'], is_active: true, last_run_date: dateOnly(at(1)) },
  { id: 'rs-2', report_type: 'VENDOR_ITEM', time_of_day: '08:30', recipient_mobile: '9845012345', channels: ['WHATSAPP', 'EMAIL'], is_active: false, last_run_date: dateOnly(at(6)) },
]
export const REPORT_LOG: any[] = Array.from({ length: 6 }, (_, i) => ({
  id: `rl-${i}`, report_type: i % 3 === 2 ? 'VENDOR_ITEM' : 'DISPATCH_DIGEST',
  content: `Dispatch digest — ${int(18, 34)} loads, ${int(120, 260)} m³, ₹${int(6, 14)}.${int(1, 9)}L billed`,
  channels_sent: ['WHATSAPP'], status: i === 4 ? 'FAILED' : 'SENT', error: i === 4 ? 'Recipient number not on WhatsApp' : null, created_at: at(i + 1, 19, 0),
}))

export const COMPANIES: any[] = [
  { ...COMPANY, gstin: BRANCH.gstin, address: BRANCH.address, city: 'Bengaluru', state: 'Karnataka', pin_code: '560066', phone: BRANCH.phone, email: 'admin@demormc.in', is_active: true, logo_path: null, created_at: at(400), branchCount: 2, userCount: 6 },
  { id: 'co-2', name: 'Konkan Concrete LLP', code: 'KONK', gstin: '27AAKFK1234Q1Z2', address: 'MIDC Taloja', city: 'Navi Mumbai', state: 'Maharashtra', pin_code: '410208', phone: '022 2741 0000', email: 'ops@konkanconcrete.in', is_active: true, logo_path: null, created_at: at(120), branchCount: 1, userCount: 4 },
  { id: 'co-3', name: 'Deccan Readymix', code: 'DECC', gstin: '36AAECD5678R1Z9', address: 'Patancheru', city: 'Hyderabad', state: 'Telangana', pin_code: '502319', phone: '040 2345 6789', email: 'hello@deccanrmc.in', is_active: false, logo_path: null, created_at: at(60), branchCount: 1, userCount: 2 },
]
