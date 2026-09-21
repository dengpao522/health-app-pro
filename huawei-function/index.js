// 华为云函数（FunctionGraph）- 健康饮食助手 AI 识别服务
// 运行时：Node.js 16+，触发器：内置 HTTP 触发器（支持 SSE 流式）
// 环境变量：DASHSCOPE_API_KEY（必填）、QWEN_MODEL（可选，默认 qwen-vl-plus）

const ALLOWED_ORIGINS = [
  'https://dengpao522.github.io',
  'https://zjh-health.cn',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];
const QWEN_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const SYSTEM_PROMPT = '你是一名专业营养师。识别图片中的所有食物（逐项列出，包括主食、菜肴、水果、饮品、零食等），并依据《中国食物成分表》估算每100克（饮品按每100毫升）的营养数据，以及图片中该食物的总重量。只返回一个 JSON 数组，不要输出 markdown 代码块、不要输出任何解释文字。数组每个元素包含字段：name(具体的中文食物名)、category(只能是:主食/肉蛋/蔬菜/水果/饮品/快餐/其他)、confidence(0到1)、calories(每100g热量kcal)、protein、fat、carbs、fiber(克)、sodium(毫克)、serving_hint(常见一份描述)、suggested_serving(数字:图中该食物估算总克重)。如果图片里没有任何食物，返回 []。';

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function parseItems(content) {
  if (typeof content !== 'string') return [];
  const s = content.indexOf('['), e = content.lastIndexOf(']');
  if (s === -1 || e === -1) return [];
  const arr = JSON.parse(content.slice(s, e + 1));
  if (!Array.isArray(arr)) return [];
  const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
  const CATS = ['主食', '肉蛋', '蔬菜', '水果', '饮品', '快餐', '其他'];
  return arr.filter(it => it && it.name).map(it => ({
    name: String(it.name).trim(),
    category: CATS.includes(it.category) ? it.category : '其他',
    confidence: Math.min(0.99, Math.max(0.1, num(it.confidence, 0.7))),
    calories: num(it.calories),
    protein: num(it.protein),
    fat: num(it.fat),
    carbs: num(it.carbs),
    fiber: num(it.fiber),
    sodium: num(it.sodium),
    serving_hint: it.serving_hint || '约100g',
    suggested_serving: Math.min(2000, Math.max(1, num(it.suggested_serving, 100))),
  }));
}

function sendSSE(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

exports.handler = async (req, res) => {
  const origin = req.headers.origin || '';
  const cors = corsHeaders(origin);

  // CORS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8', ...cors });
    res.end(JSON.stringify({ error: 'method_not_allowed' }));
    return;
  }

  // Origin 校验：放行空 Origin 和 'null'（APK WebView 兼容），拒绝恶意域名
  if (origin !== '' && origin !== 'null' && !ALLOWED_ORIGINS.includes(origin)) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8', ...cors });
    res.end(JSON.stringify({ error: 'origin_forbidden' }));
    return;
  }

  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', ...cors });
    res.end(JSON.stringify({ error: 'server_key_missing' }));
    return;
  }

  // 读取请求体
  let bodyStr = '';
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    bodyStr = Buffer.concat(chunks).toString('utf-8');
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', ...cors });
    res.end(JSON.stringify({ error: 'bad_request' }));
    return;
  }

  let image = '';
  try {
    image = JSON.parse(bodyStr).image || '';
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', ...cors });
    res.end(JSON.stringify({ error: 'bad_request' }));
    return;
  }

  if (!/^data:image\/(jpeg|jpg|png|webp);base64,/.test(image)) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', ...cors });
    res.end(JSON.stringify({ error: 'invalid_image' }));
    return;
  }

  // 发送 SSE 响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    ...cors,
  });

  sendSSE(res, { type: 'meta', engine: 'qwen-vl' });

  try {
    const upstream = await fetch(QWEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.QWEN_MODEL || 'qwen-vl-plus',
        temperature: 0.1,
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: image } },
            { type: 'text', text: SYSTEM_PROMPT },
          ],
        }],
      }),
    });

    if (!upstream.ok) {
      let detail = '';
      try { detail = (await upstream.text()).slice(0, 300); } catch (e) {}
      sendSSE(res, { type: 'error', code: 'upstream_error', status: 502, detail });
      res.end();
      return;
    }

    const data = await upstream.json().catch(() => null);
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    let items = [];
    try { items = parseItems(content); } catch (e) { items = []; }

    if (!items.length) {
      sendSSE(res, { type: 'error', code: 'no_food_detected', status: 422 });
      res.end();
      return;
    }

    for (const it of items) sendSSE(res, { type: 'item', item: it });
    sendSSE(res, { type: 'done', count: items.length });
    res.end();
  } catch (e) {
    sendSSE(res, { type: 'error', code: 'upstream_network', status: 502 });
    res.end();
  }
};
