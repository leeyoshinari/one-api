export function truncateByParagraph(
  text: string,
  maxChars = 4000
): string {
  if (text.length <= maxChars) return text

  const paragraphs = text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)

  let result = ""
  let count = 0

  for (const p of paragraphs) {
    if (count + p.length > maxChars) break

    result += p + "\n\n"
    count += p.length
  }

  return result.trim()
}

export function truncateBySentence(
  text: string,
  maxChars = 4000
): string {
  if (text.length <= maxChars) return text

  const sentences = text.split(/([。！？.!?])/)

  let result = ""
  let count = 0

  for (let i = 0; i < sentences.length - 1; i += 2) {
    const sentence = sentences[i] + sentences[i + 1]

    if (count + sentence.length > maxChars) break

    result += sentence
    count += sentence.length
  }

  return result.trim()
}

export function smartTruncate(
  text: string,
  maxChars = 4000
): string {
  if (text.length <= maxChars) return text

  const byParagraph = truncateByParagraph(text, maxChars)

  if (byParagraph.length >= maxChars * 0.8) {
    return byParagraph
  }

  return truncateBySentence(text, maxChars)
}
