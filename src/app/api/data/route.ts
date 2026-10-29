import attackData from '@/data/attacks.json'
import sitrepData from '@/data/sitreps.json'
import statementData from '@/data/statements.json'

const STATEMENT_SOURCES = new Set(['all', 'CENTCOM', 'Khatam al Anbiya', 'Hezbollah'])

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('kind') === 'statements') {
    const source = searchParams.get('source') || 'all'
    const offset = Number(searchParams.get('offset') || 0)
    const limit = Number(searchParams.get('limit') || 25)
    if (!STATEMENT_SOURCES.has(source) || !Number.isSafeInteger(offset) || offset < 0 ||
        !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      return Response.json({ error: 'Invalid statement query' }, { status: 400 })
    }

    const filtered = source === 'all'
      ? statementData
      : statementData.filter(statement => statement.sourceType === source)
    const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date))
    return Response.json({
      items: sorted.slice(offset, offset + limit),
      total: sorted.length,
    })
  }

  const days = searchParams.get('days') || '7'
  if (!['1', '3', '7', '30', '90', 'all'].includes(days)) {
    return Response.json({ error: 'Invalid date range' }, { status: 400 })
  }
  if (days === 'all') {
    return Response.json({ attacks: attackData, sitreps: sitrepData, cutoffDate: null })
  }

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - Number(days))
  const cutoff = cutoffDate.toISOString().slice(0, 10)
  return Response.json({
    attacks: attackData.filter(event => event.date >= cutoff),
    sitreps: sitrepData.filter(report => report.date >= cutoff),
    cutoffDate: cutoff,
  })
}
