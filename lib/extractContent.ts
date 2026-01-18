// import { JSDOM } from "jsdom"
// import { Readability } from "@mozilla/readability"
// import { smartTruncate } from "./smartTruncate"

// export interface ArticleResult {
//   title: string
//   link: string
//   content: string
//   length: number
// }

// export function extractArticle(html: string, url: string): ArticleResult | null {
//   const dom = new JSDOM(html, {
//     url,
//     contentType: "text/html",
//     pretendToBeVisual: true
//   })

//   const reader = new Readability(dom.window.document, {
//     debug: false,
//     charThreshold: 100
//   })

//   const article = reader.parse()

//   if (!article || !article.textContent) {
//     return null
//   }

//   const text = article.textContent
//     .replace(/\r/g, "")
//     .replace(/[ \t]+/g, " ")
//     .replace(/\n{3,}/g, "\n\n")
//     .replace(/\r\n?/g, "\n")
//     .replace(/\n\s*\n+/g, "\n\n")
//     .split("\n")
//     .map(l => l.trim())
//     .join("\n")
//     .replace(/[ \t]{2,}/g, " ")
//     .trim()

//   return {
//     title: article.title?.trim() || "",
//     link: url,
//     content: smartTruncate(text, 3000),
//     length: text.length
//   }
// }

import { extractReadableContent } from "./readability-lite";
import { smartTruncate } from "./smartTruncate"

export interface Article {
  title: string;
  content: string;
  length: number;
}

export function extractArticle(html: string): Article {
  const { title, content } = extractReadableContent(html);
  return {
    title,
    content: smartTruncate(content, 3000),
    length: content.length
  };
}
