import { CheerioAPI, load } from "cheerio";

interface Candidate {
  node: any;
  score: number;
}

const POSITIVE = /article|body|content|entry|main|page|post|text/i;
const NEGATIVE = /nav|footer|header|aside|menu|comment|combx|share|related|recommend|ads|copyright/i;

export function extractReadableContent(html: string) {
  const $ = load(html);

  $("script,style,noscript,iframe,svg,canvas").remove();

  // Step 1: 初始化候选节点
  const candidates = new Map<any, Candidate>();

  function initializeNode(node: any) {
    const tag = node.tagName?.toLowerCase?.() || "";

    let score = 0;

    if (tag === "div") score += 5;
    if (tag === "article") score += 15;
    if (tag === "section") score += 8;

    const classAndId =
      ($(node).attr("class") || "") +
      " " +
      ($(node).attr("id") || "");

    if (POSITIVE.test(classAndId)) score += 25;
    if (NEGATIVE.test(classAndId)) score -= 25;

    candidates.set(node, { node, score });
  }

  // Step 2: 扫描段落
  $("p").each((_, p) => {
    const text = $(p).text().trim();
    if (text.length < 25) return;

    const parent = p.parent;
    const grandParent = parent?.parent;

    if (!candidates.has(parent)) initializeNode(parent);
    if (grandParent && !candidates.has(grandParent)) {
      initializeNode(grandParent);
    }

    const contentScore =
      1 +
      text.split(",").length +
      Math.min(Math.floor(text.length / 100), 3);

    candidates.get(parent)!.score += contentScore;
    if (grandParent) {
      candidates.get(grandParent)!.score += contentScore / 2;
    }
  });

  // Step 3: 链接密度惩罚
  candidates.forEach(c => {
    const text = $(c.node).text();
    const linkLength = $(c.node).find("a").text().length;
    const totalLength = text.length;

    const linkDensity =
      totalLength === 0 ? 0 : linkLength / totalLength;

    c.score *= 1 - linkDensity;
  });

  // Step 4: 选最高分节点
  let topCandidate: Candidate | null = null;

  candidates.forEach(c => {
    if (!topCandidate || c.score > topCandidate.score) {
      topCandidate = c;
    }
  });

  if (!topCandidate) {
    return {
      title: $("title").text().trim(),
      content: ""
    };
  }

  // Step 5: 提取兄弟节点（Readability 精髓）
  const output: string[] = [];
  const threshold = Math.max(10, topCandidate.score * 0.2);

  const parent = $(topCandidate.node).parent();

  parent.children().each((_, el) => {
    const elNode = el;

    const candidate = candidates.get(elNode);
    const text = $(elNode).text().trim();

    let append = false;

    if (elNode === topCandidate!.node) {
      append = true;
    } else if (candidate && candidate.score >= threshold) {
      append = true;
    } else if (
      elNode.tagName === "p" &&
      text.length > 80 &&
      !NEGATIVE.test($(elNode).attr("class") || "")
    ) {
      append = true;
    }

    if (append) {
      output.push(text);
    }
  });

  return {
    title:
      $("meta[property='og:title']").attr("content") ||
      $("title").text().trim(),
    content: cleanText(output.join("\n\n"))
  };
}

function cleanText(text: string) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/免责声明.*$/s, "")
    .replace(/责任编辑.*$/s, "")
    .trim();
}
