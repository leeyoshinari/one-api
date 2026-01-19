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
