import { NextRequest, NextResponse } from 'next/server'
import { extractArticle } from '@/lib/extractContent'
export const runtime = "nodejs";

// 验证密钥
function checkAuth(req: NextRequest) {
  const configuredKey = process.env.AUTH_CODE;
  if (!configuredKey) return true; // 未配置时放行

  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const key = authHeader.split(" ")[1];
    if (key === configuredKey) return true;
  }

  const url = new URL(req.url);
  if (url.searchParams.get("auth_key") === configuredKey) return true;

  return false;
}

// 轮询 API Key 工具
function getNextKey(envVar: string) {
  const keys = (process.env[envVar] || "").split(",").map(k => k.trim()).filter(Boolean);
  if (keys.length === 0) return null;
  const counterKey = `__COUNTER_${envVar}`;
  (global as any)[counterKey] = ((global as any)[counterKey] || 0) + 1;
  const idx = (global as any)[counterKey] % keys.length;
  return keys[idx];
}


export async function POST(req: NextRequest) {
    if (!checkAuth(req)) {
        return NextResponse.json({ error: "Forbidden: Invalid API key" }, { status: 403 });
    }
    const { q, dateRestrict, prompts, stream } = await req.json();
    const num = 10;

    if (!q) {
        return NextResponse.json({ error: 'Missing query' }, { status: 400 })
    }

    const payload: any = {q: q, gl: 'cn', hl: 'zh-cn', num: num}
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
        return NextResponse.json({ error: "Search results are empty ~" }, { status: 500 });
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
                content: ''
            }
            }
        })
    )

    const documents = results.filter((doc): doc is {
        title: string;
        content: string;
    } => {
        if (!doc) return false;
        if (!doc.content) return false;
        const text = doc.content.replace(/[\r\n\t]/g, "");
        if (text.length < 100) return false;
        const chineseRatio = (text.match(/[\u4e00-\u9fa5]/g)?.length || 0) / text.length;
        if (chineseRatio < 0.1) return false;
        return true;
    });
    
    const webContext = documents.map((doc, i) => {
        return `
【资料 ${i + 1}】
标题：${doc!.title}
正文：${doc!.content}
`;}).join("\n\n");

    const finalPrompt = `
你是一个具备联网搜索能力的 AI 助手。以下内容来自实时互联网搜索结果，请你：
- 综合所有资料
- 去重
- 提炼重点
- 不要编造不存在的信息
- 必须基于以下资料回答

==============================
【联网搜索资料】
${webContext}
==============================

用户问题：
${prompts}
`;

    try {
        let apiUrl = "";
        let headers: Record<string, string> = {};
        let body: any = {};
        const apiKey = getNextKey("GEMINI_API_KEYS") || process.env.GEMINI_API_KEY!;
        const geminiModel = "models/gemini-3-flash-preview";
        const base = process.env.GEMINI_PROXY_URL || "https://generativelanguage.googleapis.com/v1beta";
        apiUrl = stream
            ? `${base}/${geminiModel}:streamGenerateContent?alt=sse&key=${apiKey}`
            : `${base}/${geminiModel}:generateContent?key=${apiKey}`;
        headers = { "Content-Type": "application/json" };
        body = { contents: [{role: "user", parts: [{ text: finalPrompt }]}] };
        let response = await fetch(apiUrl, { method: "POST", headers, body: JSON.stringify(body) });
        if (stream && response.body) {
            return new Response(response.body, { headers: { "Content-Type": "text/event-stream" } });
        }
        let data = await response.json();
        if ("error" in data && "code" in data.error) {
            apiUrl = `${base}/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;
            response = await fetch(apiUrl, { method: "POST", headers, body: JSON.stringify(body) });
            data = await response.json();
        }
        return NextResponse.json(data);
    } catch (err: any) {
        console.error("Proxy error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
