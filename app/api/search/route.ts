import { NextResponse } from 'next/server'
import { extractMainContent } from '@/lib/extractContent'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')

  if (!q) {
    return NextResponse.json({ error: 'Missing query' }, { status: 400 })
  }

  const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CSE_ID}&q=${encodeURIComponent(q)}`
  const searchRes = await fetch(searchUrl)
  const searchData = await searchRes.json()
  if (!searchData.items) {
    return NextResponse.json({ results: [] })
  }

  const results = await Promise.all(
    searchData.items.slice(0, 3).map(async (item: any) => {
      try {
        const html = await fetch(item.link, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          },
        }).then(res => res.text())

        const content = extractMainContent(html)
        return {
          title: item.title,
          link: item.link,
          snippet: item.snippet,
          content,
        }
      } catch (e) {
        return {
          title: item.title,
          link: item.link,
          snippet: item.snippet,
          content: '',
        }
      }
    })
  )

  return NextResponse.json({ results })
}
