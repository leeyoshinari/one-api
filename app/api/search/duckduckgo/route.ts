import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  const df = searchParams.get('df') || null

  if (!q) {
    return NextResponse.json({ error: 'Missing query' }, { status: 400 })
  }
  const searchUrl = "https://html.duckduckgo.com/html/"
  const searchRes = await fetch(searchUrl, {
    method: "POST",
    referrer: "https://html.duckduckgo.com/",
    mode: "cors",
    body: `q=${encodeURIComponent(q)}&b=&kl=&df=${df}`,
    headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "accept-language": "zh-CN,zh;q=0.9",
        "cache-control": "max-age=0",
        "content-type": "application/x-www-form-urlencoded",
        "priority": "u=0, i",
        "sec-ch-ua": '"Chromium";v="152", "Not?A_Brand";v="24", "Google Chrome";v="152"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "same-origin",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
        "Referer": "https://html.duckduckgo.com/"
    }
  })
  const searchData = await searchRes.text()
  return new NextResponse(searchData, {
    status: searchRes.status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
