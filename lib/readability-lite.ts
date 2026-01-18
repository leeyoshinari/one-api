import { load } from "cheerio";

interface Candidate {
  node: unknown;
  score: number;
}

const POSITIVE = /article|body|content|entry|main|page|post|text/i;
const NEGATIVE = /nav|footer|header|aside|menu|comment|combx|share|related|recommend|ads|copyright/i;

export function extractReadableContent(html: string) {
  const $ = load(html);

  $("script,style,noscript,iframe,svg,canvas").remove();
  $("nav,header,footer,aside").remove();

  const candidates = new Map<unknown, Candidate>();

  function init(node: unknown) {
    if (!node || candidates.has(node)) return;

    const el = node as any;
    const tag = el.tagName?.toLowerCase?.() || "";

    let score = 0;
    if (tag === "article") score += 25;
    else if (tag === "section") score += 15;
    else if (tag === "div") score += 5;

    const classAndId =
      ($(el).attr("class") || "") +
      " " +
      ($(el).attr("id") || "");

    if (POSITIVE.test(classAndId)) score += 25;
    if (NEGATIVE.test(classAndId)) score -= 25;

    candidates.set(node, { node, score });
  }

  $("p").each((_, p) => {
    const text = $(p).text().trim();
    if (text.length < 25) return;

    const parent = (p as any).parent;
    const grand = parent?.parent;

    init(parent);
    init(grand);

    const score =
      1 +
      (text.match(/[，。！？；：,.!?]/g) || []).length +
      Math.min(Math.floor(text.length / 100), 3);

    const pC = candidates.get(parent);
    if (pC) pC.score += score;

    const gC = candidates.get(grand);
    if (gC) gC.score += score / 2;
  });

  candidates.forEach(c => {
    const textLen = $(c.node as any).text().length;
    if (!textLen) return;

    const linkLen = $(c.node as any).find("a").text().length;
    c.score *= 1 - linkLen / textLen;
  });

  let top: Candidate | null = null;

  for (const c of candidates.values()) {
    if (!top || c.score > top.score) {
      top = c;
    }
  }

  if (top === null) {
    return {
      title: $("title").text().trim(),
      content: ""
    };
  }

  const threshold = Math.max(10, top.score * 0.2);
  const output: string[] = [];

  const parent = $(top.node as any).parent();

  parent.children().each((_, el) => {
    const node = el as unknown;
    const text = $(el).text().trim();
    if (!text) return;

    const c = candidates.get(node);
    let ok = false;

    if (node === top.node) ok = true;
    else if (c && c.score >= threshold) ok = true;
    else if (
      (el as any).tagName === "p" &&
      text.length > 80 &&
      !NEGATIVE.test($(el).attr("class") || "")
    ) {
      ok = true;
    }

    if (ok) output.push(text);
  });

  const title =
    $("meta[property='og:title']").attr("content") ||
    $("title").text().trim();

  return {
    title,
    content: clean(output.join("\n\n"))
  };
}

function clean(text: string) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/免责声明[\s\S]*$/, "")
    .replace(/责任编辑[\s\S]*$/, "")
    .replace(/相关阅读[\s\S]*$/, "")
    .replace(/推荐阅读[\s\S]*$/, "")
    .trim();
}
