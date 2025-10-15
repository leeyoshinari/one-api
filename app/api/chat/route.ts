import { NextRequest, NextResponse } from "next/server";
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

  try {
    const { model, messages, stream } = await req.json();
    let apiUrl = "";
    let headers: Record<string, string> = {};
    let body: any = {};

    if (model.startsWith("gpt-")) {
      const apiKey = getNextKey("OPENAI_API_KEYS") || process.env.OPENAI_API_KEY!;
      const base = process.env.OPENAI_PROXY_URL || "https://api.openai.com/v1";
      apiUrl = `${base}/chat/completions`;
      headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
      body = { model, messages, stream };
    }

    else if (model.startsWith("gemini")) {
      const apiKey = getNextKey("GEMINI_API_KEYS") || process.env.GEMINI_API_KEY!;
      const geminiModel = "models/" + model;
      const base = process.env.GEMONI_PROXY_URL || "https://generativelanguage.googleapis.com/v1beta";
      apiUrl = stream
        ? `${base}/${geminiModel}:streamGenerateContent?alt=sse&key=${apiKey}`
        : `${base}/${geminiModel}:generateContent?key=${apiKey}`;
      headers = { "Content-Type": "application/json" };
      body = { contents: [{ parts: messages.map((m: any) => ({ text: m.content })) }] };
    }

    const response = await fetch(apiUrl, { method: "POST", headers, body: JSON.stringify(body) });
    if (stream && response.body)
      return new Response(response.body, { headers: { "Content-Type": "text/event-stream" } });

    const data = await response.json();
    return NextResponse.json(data);

  } catch (err: any) {
    console.error("Proxy error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
