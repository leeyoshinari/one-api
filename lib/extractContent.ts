import { load } from 'cheerio'

export function extractMainContent(html: string): string {
  const $ = load(html)
  $('script, style, nav, footer, header, aside, noscript').remove()
  return $('body')
    .text()
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function normalizeText(text: string): string {
  return text
    .replace(/\t+/g, ' ')
    .split('\n')
    .map(l => l.trim())
    .join('\n')
    .replace(/ {2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
