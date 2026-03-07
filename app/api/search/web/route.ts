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
    const { prompts, stream } = await req.json();

    if (!prompts) {
        return NextResponse.json({ error: 'Missing query' }, { status: 400 })
    }

    try {
        const apiKey = getNextKey("GEMINI_API_KEYS") || process.env.GEMINI_API_KEY!;
        const geminiModel = "models/gemini-3-flash-preview";
        const base = process.env.GEMINI_PROXY_URL || "https://generativelanguage.googleapis.com/v1beta";
        const apiUrl = stream
            ? `${base}/${geminiModel}:streamGenerateContent?alt=sse&key=${apiKey}`
            : `${base}/${geminiModel}:generateContent?key=${apiKey}`;
        const headers = { "Content-Type": "application/json" };
        const body = { contents: [{role: "user", parts: [{ text: prompts }]}], tools: [{ google_search: {} }], tool_config: {
                     google_search_retrieval: { dynamic_retrieval_config: { mode: "MODE_DYNAMIC", dynamic_threshold: 0 }}} };
        let response = await fetch(apiUrl, { method: "POST", headers, body: JSON.stringify(body) });
        if (!response.ok) {
            const errorData = await response.json();
            return NextResponse.json(errorData, { status: response.status });
        }
        if (stream && response.body) {
            return new Response(response.body, { headers: { "Content-Type": "text/event-stream" } });
        }
        let data = await response.json();
        return NextResponse.json(data);
    } catch (err: any) {
        console.error("Proxy error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
