import { NextRequest, NextResponse } from 'next/server'

const MAX_BODY_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(req: NextRequest) {
  try {
    // 读取 JSON 请求体
    const raw = await req.text()
    if (raw.length > MAX_BODY_SIZE) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 })
    }

    let payload: any
    try {
      payload = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    // 解构请求数据（去掉 params）
    const { url, method = 'GET', headers = {}, body = null } = payload
    if (!url) {
      return NextResponse.json({ error: 'Missing url in request body' }, { status: 400 })
    }

    // 复制并过滤 headers
    const forwardHeaders: Record<string, string> = {}
    Object.entries(headers).forEach(([key, value]) => {
      if (
        value &&
        !['host', 'content-length', 'connection'].includes(key.toLowerCase())
      ) {
        forwardHeaders[key] = String(value);
      }
    })

    // 准备 body（仅非 GET/HEAD 请求）
    let bodyToSend: any = null
    if (method !== 'GET' && method !== 'HEAD' && body != null) {
      const contentType = forwardHeaders['Content-Type'] || forwardHeaders['content-type'] || ''

      if (typeof body === 'string') {
        // 如果前端传来的是字符串，说明可能是 form-urlencoded 或 XML 或纯文本
        bodyToSend = body
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        // 如果 body 是对象，但 content-type 指明是 urlencoded，则自动序列化
        const params = new URLSearchParams(body).toString()
        bodyToSend = params
        forwardHeaders['Content-Type'] = 'application/x-www-form-urlencoded'
      } else if (typeof body === 'object' && !(body instanceof ArrayBuffer)) {
        // 默认 JSON 序列化
        bodyToSend = JSON.stringify(body)
        if (!forwardHeaders['Content-Type']) {
          forwardHeaders['Content-Type'] = 'application/json'
        }
      } else {
        // 其他情况直接发送
        bodyToSend = body
      }
    }

    // 发起转发请求
    console.log(url);
    const response = await fetch(url, {
      method,
      headers: forwardHeaders,
      body: method === 'GET' || method === 'HEAD' ? undefined : bodyToSend,
      redirect: 'manual',
    })

    // 原样返回响应体、状态码和 headers
    const buffer = await response.arrayBuffer()
    const resHeaders = new Headers()
    response.headers.forEach((value, key) => resHeaders.set(key, value))

    // 删除无效的压缩标头，防止下游重复解压
    if (['gzip', 'br', 'deflate'].includes(resHeaders.get('content-encoding') || '')) {
        resHeaders.delete('content-encoding')
    }
    resHeaders.delete('content-length')

    return new NextResponse(buffer, { status: response.status, headers: resHeaders })
  } catch (err: any) {
    console.error('Proxy Error:', err)
    return NextResponse.json({ error: err?.message || 'Proxy failed' }, { status: 500 })
  }
}
