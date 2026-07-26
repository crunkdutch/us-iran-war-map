// Hormuz data wrapper - re-exports JSON for reliable Turbopack bundling
// The pipeline generates hormuz-data.json each run; this TS file ensures
// the bundler includes the data regardless of bundler (webpack/turbopack)

import raw from './hormuz-data.json'

export interface HormuzEntry {
  date: string
  daily: number
  label: string
  note: string
}

const data: HormuzEntry[] = raw as HormuzEntry[]
export default data
