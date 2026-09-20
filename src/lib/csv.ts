// Minimal CSV parser — handles quoted fields, escaped quotes (""), and commas inside quotes.
// Good enough for exports from Excel/Google Sheets, without pulling in a dependency.
export function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  // Normalize line endings so \r\n and \r both behave like \n
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += c
    }
  }
  // Last field/row (file may or may not end with a newline)
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter(r => r.some(cell => cell.trim() !== ''))
}

export interface ParsedCSV {
  headers: string[]
  rows: string[][]
}

export function parseCSVWithHeaders(text: string): ParsedCSV {
  const all = parseCSV(text)
  if (all.length === 0) return { headers: [], rows: [] }
  return { headers: all[0].map(h => h.trim()), rows: all.slice(1) }
}

/** Best-effort auto-match of a CSV header to a target field key, ignoring case/spaces/underscores. */
export function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_-]+/g, '')
}
