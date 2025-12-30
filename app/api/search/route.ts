import { NextResponse } from 'next/server'
import { extractMainContent, normalizeText } from '@/lib/extractContent'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  const lang = searchParams.get('lang')
  const dateRestrict = searchParams.get('dateRestrict')
  const num = searchParams.get('num')

  if (!q) {
    return NextResponse.json({ error: 'Missing query' }, { status: 400 })
  }

  let searchUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CSE_ID}&q=${encodeURIComponent(q)}`
  if (lang) {
    searchUrl = searchUrl + '&lr=' + lang    // lang_zh
  }
  if (dateRestrict) {
    searchUrl = searchUrl + '&dateRestrict=' + dateRestrict
  }
  if (num) {
    searchUrl = searchUrl + '&num=' + num
  } else {
    searchUrl = searchUrl + '&num=10'
  }
  const searchRes = await fetch(searchUrl)
  const searchData = await searchRes.json()
  if (!searchData.items) {
    return NextResponse.json({ results: [] })
  }

  const results = await Promise.all(
    searchData.items.slice(0, 10).map(async (item: any) => {
      try {
        const html = await fetch(item.link, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          },
        }).then(res => res.text())

        const content = normalizeText(extractMainContent(html))
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
