addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

/**
 * 简单的 Cloudflare Worker 示例：
 * - 支持 POST /api/messages，返回 JSON 响应并回显 `message` 字段
 * - 支持 OPTIONS 用于 CORS 预检
 * - 返回的头包含允许跨域的 CORS 头，便于直接在浏览器中调用
 */
async function handleRequest(request) {
  const url = new URL(request.url)
  const headers = defaultCorsHeaders()

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  if (url.pathname === '/api/messages' && request.method === 'POST') {
    try {
      const body = await request.json()
      const message = body && body.message ? String(body.message) : ''
      const reply = `已收到消息：${message}`
      const respBody = { reply, echo: message }
      return new Response(JSON.stringify(respBody), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json;charset=UTF-8' }
      })
    } catch (err) {
      const respBody = { error: '无法解析请求体', detail: err.message }
      return new Response(JSON.stringify(respBody), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json;charset=UTF-8' }
      })
    }
  }

  // 默认返回简单说明页面（JSON）
  const info = {
    name: 'chat-worker-sample',
    routes: ['/api/messages'],
    note: '此 Worker 为示例，接受 POST JSON {"message":"..."} 并返回 {"reply":"..."}'
  }
  return new Response(JSON.stringify(info), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } })
}

function defaultCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}
