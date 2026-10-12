const ALLOWED_ORIGINS = [
  'https://dengpao522.github.io',
  'https://zjh-health.cn',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];
// ===== 防刷配置 =====
// 请求头校验：自有前端调用时带上，裸 curl/脚本直接调用没有此头会被拒。
// 仅作轻量混淆层（不是加密），提高滥用门槛；真正兜底是限流。
const REQUIRED_HEADER = 'x-app-client';
const REQUIRED_VALUE = 'healthpro-v1';
// 限流：每个 IP 每 60 秒最多 10 次识别请求（Workers 内存桶，实例重启即清零）
const RATE_LIMIT = { max: 10, windowMs: 60 * 1000 };
// 图片上限：base64 字符串 6MB（约对应 4.5MB 原图，前端已压缩到 1000px 远低于此值）
const MAX_IMAGE_LEN = 6 * 1024 * 1024;
// 内存限流桶：{ ip: { count, windowStart } }
const rateBuckets = new Map();
// 惰性清理：每次检查时顺手删除过期桶，防止 Map 无限增长。
// 注意：Workers 环境禁止 setInterval 等全局后台定时器，只能这样在请求路径内清理。
function cleanExpiredBuckets(now) {
  for (const [ip, b] of rateBuckets) {
    if (now - b.windowStart > RATE_LIMIT.windowMs) rateBuckets.delete(ip);
  }
}

// 单 IP 限流判断：窗口内超限返回 true
function isRateLimited(ip) {
  const now = Date.now();
  cleanExpiredBuckets(now);
  const bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.windowStart > RATE_LIMIT.windowMs) {
    rateBuckets.set(ip, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT.max;
}
const QWEN_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const SYSTEM_PROMPT = '你是一名专业营养师。识别图片中的所有食物（逐项列出，包括主食、菜肴、水果、饮品、零食等），并依据《中国食物成分表》估算每100克（饮品按每100毫升）的营养数据，以及图片中该食物的总重量。只返回一个 JSON 数组，不要输出 markdown 代码块、不要输出任何解释文字。数组每个元素包含字段：name(具体的中文食物名)、category(只能是:主食/肉蛋/蔬菜/水果/饮品/快餐/其他)、confidence(0到1)、calories(每100g热量kcal)、protein、fat、carbs、fiber(克)、sodium(毫克)、serving_hint(常见一份描述)、suggested_serving(数字:图中该食物估算总克重)。如果图片里没有任何食物，返回 []。';

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    // 放行自定义头，前端请求头校验依赖它
    'Access-Control-Allow-Headers': 'Content-Type, ' + REQUIRED_HEADER,
  };
}
function jsonResponse(data, status, origin) {
  return new Response(JSON.stringify(data), { status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) } });
}
function parseItems(content) {
  if (typeof content !== 'string') return [];
  const s = content.indexOf('['), e = content.lastIndexOf(']');
  if (s === -1 || e === -1) return [];
  const arr = JSON.parse(content.slice(s, e + 1));
  if (!Array.isArray(arr)) return [];
  const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
  const CATS = ['主食','肉蛋','蔬菜','水果','饮品','快餐','其他'];
  return arr.filter(it => it && it.name).map(it => ({
    name: String(it.name).trim(),
    category: CATS.includes(it.category) ? it.category : '其他',
    confidence: Math.min(0.99, Math.max(0.1, num(it.confidence, 0.7))),
    calories: num(it.calories), protein: num(it.protein), fat: num(it.fat),
    carbs: num(it.carbs), fiber: num(it.fiber), sodium: num(it.sodium),
    serving_hint: it.serving_hint || '约100g',
    suggested_serving: Math.min(2000, Math.max(1, num(it.suggested_serving, 100))),
  }));
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, origin);
    if (origin !== '' && origin !== 'null' && !ALLOWED_ORIGINS.includes(origin)) return jsonResponse({ error: 'origin_forbidden' }, 403, origin);
    // ===== 防刷第一层：请求头校验（APK WebView 的 Origin 是 'null'，同样要求带头） =====
    if (request.headers.get(REQUIRED_HEADER) !== REQUIRED_VALUE) {
      return jsonResponse({ error: 'client_forbidden' }, 403, origin);
    }
    // ===== 防刷第二层：单 IP 限流（CF 的 ip 在 CF-Connecting-IP 头） =====
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (isRateLimited(clientIp)) {
      return jsonResponse({ error: 'rate_limited' }, 429, origin);
    }
    if (!env.DASHSCOPE_API_KEY) return jsonResponse({ error: 'server_key_missing' }, 500, origin);
    let image = '';
    try { image = (await request.json()).image || ''; } catch (e) { return jsonResponse({ error: 'bad_request' }, 400, origin); }
    if (!/^data:image\/(jpeg|jpg|png|webp);base64,/.test(image)) return jsonResponse({ error: 'invalid_image' }, 400, origin);
    // ===== 防刷第三层：图片体积上限（省 token、防超大 payload 打爆内存） =====
    if (image.length > MAX_IMAGE_LEN) return jsonResponse({ error: 'image_too_large' }, 413, origin);

    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        const send = (obj) => controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
        send({ type: 'meta', engine: 'qwen-vl' });
        try {
          const upstream = await fetch(QWEN_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${env.DASHSCOPE_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: env.QWEN_MODEL || 'qwen-vl-plus', temperature: 0.1, max_tokens: 1500,
              messages: [{ role: 'user', content: [
                { type: 'image_url', image_url: { url: image } },
                { type: 'text', text: SYSTEM_PROMPT } ] }] }),
          });
          if (!upstream.ok) {
            let detail = '';
            try { detail = (await upstream.text()).slice(0, 300); } catch (e) {}
            send({ type: 'error', code: 'upstream_error', status: 502, detail });
            controller.close(); return;
          }
          const data = await upstream.json().catch(() => null);
          const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
          let items = [];
          try { items = parseItems(content); } catch (e) { items = []; }
          if (!items.length) {
            send({ type: 'error', code: 'no_food_detected', status: 422 });
            controller.close(); return;
          }
          for (const it of items) send({ type: 'item', item: it });
          send({ type: 'done', count: items.length });
          controller.close();
        } catch (e) {
          send({ type: 'error', code: 'upstream_network', status: 502 });
          controller.close();
        }
      }
    });
    return new Response(stream, { status: 200, headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      ...corsHeaders(origin),
    }});
  },
};
