import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";

// 1. 验证客户端的 AUTH_CODE (你的业务鉴权)
function checkAuth(req: NextRequest) {
  const configuredKey = process.env.AUTH_CODE;
  if (!configuredKey) return true; // 未配置时放行

  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    if (authHeader.split(" ")[1] === configuredKey) return true;
  }
  return false;
}

// 3. 核心代理处理函数 (同时支持 POST 和 GET)
async function handleProxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // 鉴权失败，返回符合 OpenAI 错误格式的 JSON
  if (!checkAuth(req)) {
    return NextResponse.json(
      { error: { message: "Forbidden: Invalid proxy API key", type: "proxy_error", code: "invalid_api_key" } },
      { status: 401 }
    );
  }

  try {
    // 获取真实的 OpenAI API Key
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: { message: "No OpenAI API Key configured on proxy", type: "proxy_error" } },
        { status: 500 }
      );
    }

    // 解析动态路径 (例如: ['chat', 'completions'])
    const resolvedParams = await params;
    const targetPath = resolvedParams.path.join('/');
    
    // 允许自定义 Base URL，默认指向官方 v1
    const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    const targetUrl = new URL(`${baseUrl}/${targetPath}`);

    // 复制原始查询参数
    const originalSearchParams = new URL(req.url).searchParams;
    originalSearchParams.forEach((value, key) => {
      targetUrl.searchParams.append(key, value);
    });

    // 构建转发 Headers
    const headers = new Headers();
    req.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      // 剔除客户端的代理鉴权 Header 和 hop-by-hop headers
      if (
        lowerKey !== 'authorization' &&
        lowerKey !== 'host' &&
        lowerKey !== 'connection' &&
        lowerKey !== 'content-length'
      ) {
        headers.set(key, value);
      }
    });

    // 【核心】：注入真实的 OpenAI API Key
    headers.set('Authorization', `Bearer ${openaiApiKey}`);
    
    // 确保 POST 请求有 content-type
    if (req.method === 'POST' && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }

    const response = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: headers,
      body: req.method === 'GET' ? null : req.body,
      // @ts-ignore
      duplex: 'half', 
    });

    // 处理返回的 Headers
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('transfer-encoding');
    responseHeaders.delete('connection');

    // 原样返回 OpenAI 的响应 (状态码、Headers、Body 全部透传)
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err.message || "Internal Proxy Error", type: "proxy_error" } },
      { status: 500 }
    );
  }
}

// 导出 POST 和 GET 方法 (OpenAI 的 /models 是 GET，其他大多是 POST)
export async function POST(req: NextRequest, context: any) {
    return handleProxy(req, context);
}

export async function GET(req: NextRequest, context: any) {
  return handleProxy(req, context);
}