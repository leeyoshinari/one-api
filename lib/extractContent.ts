import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'

export function extractMainContent(html: string): string {
  try {
    const dom = new JSDOM(html)
    const reader = new Readability(dom.window.document)
    const article = reader.parse()
    return (
      article?.textContent
        ?.replace(/\s+\n/g, '\n')
        ?.replace(/\n{3,}/g, '\n\n')
        ?.trim() || ''
    )
  } catch (e) {
    return ''
  }
}
