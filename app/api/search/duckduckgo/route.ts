import { NextResponse } from 'next/server'
import { search, SafeSearchType} from 'duck-duck-scrape'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  const df = searchParams.get('df') || null

  if (!q) {
    return NextResponse.json({ error: 'Missing query' }, { status: 400 })
  }
  const searchData = await search(q, {safeSearch: SafeSearchType.STRICT,})
  return NextResponse.json(searchData)
}
