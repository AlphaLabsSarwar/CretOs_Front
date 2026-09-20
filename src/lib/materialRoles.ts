// Mirrors apps/api/src/utils/materials.ts — the 10 fixed "roles" a concrete
// mix recipe needs (grade_masters has one qty column per role). Assigning an
// item to a role here is what lets Raw Material Stock and dispatch
// auto-deduction know which catalog item is "the cement" right now.
export const MATERIAL_ROLES = [
  'CEMENT', 'FLYASH', 'GGBS', 'MM20', 'MM10', 'MM40', 'CSAND', 'FSAND', 'WATER', 'ADMIX',
] as const

export type MaterialRole = typeof MATERIAL_ROLES[number]

export const MATERIAL_ROLE_LABELS: Record<string, string> = {
  CEMENT: 'Cement',
  FLYASH: 'Fly Ash',
  GGBS: 'GGBS',
  MM20: '20mm Aggregate',
  MM10: '10mm Aggregate',
  MM40: '40mm Aggregate',
  CSAND: 'Crushed Sand',
  FSAND: 'Natural Sand',
  WATER: 'Water',
  ADMIX: 'Admixture',
}
