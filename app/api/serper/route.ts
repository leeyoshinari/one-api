import { NextResponse } from 'next/server'
import { extractArticle } from '@/lib/extractContent'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  const q = searchParams.get('q')
  const lang = searchParams.get('lang')
  const dateRestrict = searchParams.get('tbs')
  const num = Number(searchParams.get('num') || 10)

  if (!q) {
    return NextResponse.json({ error: 'Missing query' }, { status: 400 })
  }

  const payload: any = {
    q: q,
    gl: 'cn',
    hl: 'zh-cn',
    num: num
  }

  if (lang?.includes('zh')) {
    payload.hl = 'zh-cn'
  }

  // 时间限制映射
  // h-过去一小时 / d-过去一天 / w-过去一周 / m-过去一个月 / y-过去一年
  if (dateRestrict) {
    payload.tbs = `qdr:${dateRestrict}`
  }

  const searchRes = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.SERPER_API_KEY!,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  const searchData = await searchRes.json()

  if (!searchData.organic) {
    return NextResponse.json({ results: [] })
  }

  const results = await Promise.all(
    searchData.organic.slice(0, num).map(async (item: any) => {
      try {
        const html = await fetch(item.link, {
          headers: {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'}
        }).then(res => res.text())
        return extractArticle(html)
      } catch (e) {
        return {
          title: item.title,
          link: item.link,
          length: 0,
          content: ''
        }
      }
    })
  )

  return NextResponse.json({ results })
}
