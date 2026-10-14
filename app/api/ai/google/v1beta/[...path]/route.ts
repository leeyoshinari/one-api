import { NextRequest, NextResponse } from "next/server";

// 验证密钥
function checkAuth(req: NextRequest) {
  const configuredKey = process.env.AUTH_CODE;
  if (!configuredKey) return true; // 未配置时放行

  const url = new URL(req.url);
  if (url.searchParams.get("key") === configuredKey) return true;
  return false;
}

export async function POST (req: NextRequest,
    { params }: {params: Promise<{ path: string[] }> }
) {
    if (!checkAuth(req)) {
        return NextResponse.json({ error: "Forbidden: Invalid API key" }, { status: 403 });
    }

    try {
        const geminiApiKey = process.env.GEMINI_API_KEY;
        if (!geminiApiKey) {
            return NextResponse.json({ error: "No Gemini API Key configured" }, { status: 500 });
        }
        
        // 解析动态路径 (例如: ['models', 'gemini-2.5-flash:generateContent'])
        const resolvedParams = await params;
        const targetPath = resolvedParams.path.join('/');
    
        // 允许自定义 Base URL，默认指向官方 v1beta
        const baseUrl = "https://generativelanguage.googleapis.com/v1beta";
        const targetUrl = new URL(`${baseUrl}/${targetPath}`);

        // 复制原始查询参数，但剔除我们的 auth_key，并注入真实的 Gemini key
        const originalSearchParams = new URL(req.url).searchParams;
        originalSearchParams.forEach((value, key) => {
            if (key !== 'key') {
                targetUrl.searchParams.append(key, value);
            }
        });
        // 强制覆盖或设置真实的 key
        targetUrl.searchParams.set('key', geminiApiKey);

        // 构建转发 Headers (过滤掉 hop-by-hop 和我们自己的鉴权头)
        const headers = new Headers();
        req.headers.forEach((value, key) => {
            const lowerKey = key.toLowerCase();
            if (
                lowerKey !== 'authorization' &&
                lowerKey !== 'host' &&
                lowerKey !== 'connection' &&
                lowerKey !== 'content-length' // fetch 会自动计算
            ) {
                headers.set(key, value);
            }
        });
    
        // 确保有正确的 content-type
        if (!headers.has('content-type')) {
            headers.set('content-type', 'application/json');
        }
        console.log(targetUrl.toString());

        const response = await fetch(targetUrl.toString(), {
            method: req.method,
            headers: headers,
            body: req.body, 
            // @ts-ignore
            duplex: 'half',
        });

        // 处理返回的 Headers
        const responseHeaders = new Headers(response.headers);
        responseHeaders.delete('transfer-encoding');
        responseHeaders.delete('connection');
    
        // 如果是流式响应 (SSE)，确保客户端能正确识别
        if (targetUrl.searchParams.get('alt') === 'sse') {
            responseHeaders.set('content-type', 'text/event-stream');
            responseHeaders.set('cache-control', 'no-cache');
            responseHeaders.set('connection', 'keep-alive');
        }

        // 原样返回 Gemini 的响应
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
        });
    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err.message || "Internal Proxy Error" }, { status: 500 });
    }
}