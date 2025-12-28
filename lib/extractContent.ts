import cheerio from 'cheerio'

export function extractMainContent(html: string): string {
  const $ = cheerio.load(html)
  $('script, style, nav, footer, header, aside, noscript').remove()
  const text = $('body')
    .text()
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text
}
