import { NextResponse } from 'next/server'
import { extractArticle } from '@/lib/extractContent'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  const lang = searchParams.get('lang')
  const dateRestrict = searchParams.get('dateRestrict')
  const num = Number(searchParams.get('num') || 10)

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
  }
  const searchRes = await fetch(searchUrl)
  const searchData = await searchRes.json()
  if (!searchData.items) {
    return NextResponse.json({ results: [] })
  }

  const results = await Promise.all(
    searchData.items.slice(0, num).map(async (item: any) => {
      try {
        const html = await fetch(item.link, {
          headers: {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'},
        }).then(res => res.text())
        return extractArticle(html)
      } catch (e) {
        return {
          title: item.title,
          link: item.link,
          length: 0,
          content: '',
        }
      }
    })
  )

  return NextResponse.json({ results })
}
