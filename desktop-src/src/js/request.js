// 统一请求封装（桌面版 - 相对路径 / 纯前端 Mock 模式）
import { mockRequest } from './mock.js';

const MOCK_MODE = true; // 纯前端模式，数据存 localStorage
const BASE_URL = '';

// 真实 AI 视觉识别代理地址。
// 部署阿里云函数计算或 Cloudflare Worker 后，将地址填入下方或通过 localStorage 设置：
//   localStorage.setItem('ai_worker_url', 'https://health-ai-xxxx.cn-hangzhou.fcapp.run')
// 留空则使用离线颜色启发式（结果仅供参考，页面会标注"离线估算"）。
const AI_WORKER_URL = 'https://api.zjh-health.cn';

// Worker/模型错误码 -> 用户可读提示
const AI_ERROR_TEXT = {
  no_food_detected: '没在图片里检测到食物，请换一张清晰的饭菜照片',
  invalid_image: '图片格式不正确，请重新拍摄',
  bad_request: '请求格式有误，请重试',
  origin_forbidden: '当前域名未授权调用识别服务',
  server_key_missing: '识别服务未配置 API Key，请联系开发者',
  rate_limited: '请求太频繁，请稍后再试',
  upstream_network: '网络连接失败，请检查网络后重试',
  upstream_error: 'AI 识别服务暂时不可用，请稍后再试',
  upstream_bad_json: '识别服务返回异常，请重试',
  upstream_timeout: 'AI 识别时间过长，请稍后再试（已保留已识别结果）',
  stream_failed: '识别中断，请重试',
  result_parse_failed: '识别结果解析失败，请重试',
};

function getToken() {
  const info = uni.getStorageSync('userInfo');
  return info && info.access_token ? info.access_token : '';
}

function request(options) {
  return new Promise((resolve, reject) => {
    if (MOCK_MODE) {
      // 模拟网络延迟；try/catch 兜底，任何异常都要 reject，否则页面会永久转圈
      setTimeout(() => {
        try {
          const res = mockRequest(options.method || 'GET', options.url, options.data || {});
          if (res && res.__status) {
            if (res.__status === 401) {
              uni.removeStorageSync('userInfo');
              uni.reLaunch({ url: '/pages/login/login' });
            } else {
              uni.showToast({ title: res.detail || '请求失败', icon: 'none' });
            }
            reject(res);
          } else {
            resolve(res);
          }
        } catch (err) {
          console.error('[mock] request error:', err);
          uni.showToast({ title: '服务异常，请重试', icon: 'none' });
          reject(err);
        }
      }, 200);
      return;
    }
    
    uni.request({
      url: (window.__BASE_URL__ || BASE_URL) + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        ...(getToken() ? { 'Authorization': 'Bearer ' + getToken() } : {}),
        ...(options.header || {})
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else if (res.statusCode === 401) {
          uni.removeStorageSync('userInfo');
          uni.reLaunch({ url: '/pages/login/login' });
          reject(res);
        } else {
          uni.showToast({ title: (res.data && res.data.detail) || '请求失败', icon: 'none' });
          reject(res);
        }
      },
      fail: (err) => {
        uni.showToast({ title: '网络错误，请检查后端是否启动', icon: 'none' });
        reject(err);
      }
    });
  });
}

// 从 dataURL/blob 图片提取颜色特征（24x24 缩略图采样），用于本地启发式识别
function extractImageFeatures(src) {
  return new Promise((resolve) => {
    const done = (v) => resolve(v);
    try {
      if (!src || typeof document === 'undefined' ||
          !(src.startsWith('data:image') || src.startsWith('blob:'))) {
        return done(null);
      }
      const img = new Image();
      img.onload = () => {
        try {
          const N = 24;
          const c = document.createElement('canvas');
          c.width = N; c.height = N;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, N, N);
          const px = ctx.getImageData(0, 0, N, N).data;
          let n = 0, rS = 0, gS = 0, bS = 0, satS = 0;
          let green = 0, red = 0, warm = 0, pale = 0, dark = 0, brown = 0, yellow = 0, fresh = 0;
          for (let i = 0; i < px.length; i += 4) {
            const r = px[i], g = px[i + 1], b = px[i + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
            n++; rS += r; gS += g; bS += b; satS += (mx - mn) / 255;
            if (g > r * 1.08 && g > b * 1.05) green++;
            if (r > g * 1.22 && r > b * 1.22) red++;
            if (r > 120 && r > b * 1.25 && g > 55) warm++;
            if (lum > 168 && (mx - mn) < 45) pale++;
            if (lum < 70) dark++;
            if (r > g && g > b && r < 190 && (mx - mn) < 85) brown++;
            if (r > 180 && g > 150 && b < 120) yellow++;
            if (g > 110 && g > r * 0.95) fresh++;
          }
          done({
            avgR: Math.round(rS / n), avgG: Math.round(gS / n), avgB: Math.round(bS / n),
            luminance: Math.round((0.299 * rS + 0.587 * gS + 0.114 * bS) / n),
            saturation: +(satS / n).toFixed(3),
            greenRatio: +(green / n).toFixed(3),
            redRatio: +(red / n).toFixed(3),
            warmRatio: +(warm / n).toFixed(3),
            paleRatio: +(pale / n).toFixed(3),
            darkRatio: +(dark / n).toFixed(3),
            brownRatio: +(brown / n).toFixed(3),
            yellowRatio: +(yellow / n).toFixed(3),
            freshRatio: +(fresh / n).toFixed(3),
          });
        } catch (e) { done(null); }
      };
      img.onerror = () => done(null);
      img.src = src;
    } catch (e) { done(null); }
  });
}

// 调用真实 AI 视觉识别（代理服务中转）。err.code 区分失败类型，供上层决定是否回退离线估算
function recognizeByAI(dataUrl) {
  const workerUrl = (typeof localStorage !== 'undefined' && localStorage.getItem('ai_worker_url')) || AI_WORKER_URL;
  return new Promise((resolve, reject) => {
    if (!workerUrl) { reject(Object.assign(new Error('未配置 AI 服务'), { code: 'no_worker' })); return; }
    const controller = new AbortController();
    // qwen3.8-max 旗舰视觉模型首次调用可能需要 20~40 秒（含函数冷启动），给足 45 秒
    const timer = setTimeout(() => controller.abort(), 45000);
    fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl }),
      signal: controller.signal,
    })
      .then(async (resp) => {
        let data = null;
        try { data = await resp.json(); } catch (e) {}
        if (resp.ok && data && Array.isArray(data.items) && data.items.length) {
          resolve({ items: data.items, engine: data.engine || 'qwen-ai' });
        } else {
          const code = (data && data.error) || 'upstream_error';
          // 调试期：带上百炼返回的 HTTP 状态码，便于区分 401(密钥错)/404(模型未开通)/429(欠费限流)
          const codeWithStatus = data && data.status ? (code + ':' + data.status) : code;
          const err = new Error(AI_ERROR_TEXT[code] || '识别失败，请重试');
          err.code = codeWithStatus;
          reject(err);
        }
      })
      .catch((err) => {
        const e = new Error(err && err.name === 'AbortError' ? '识别超时，请重试' : '网络连接失败，请检查网络后重试');
        e.code = (err && err.name === 'AbortError') ? 'timeout' : 'network';
        reject(e);
      })
      .finally(() => clearTimeout(timer));
  });
}

// 流式 AI 识别（SSE）：每认出一道菜立即回调 onItem(item)，全部结束 resolve { engine, count }
// handlers: { onItem(item), onMeta(engine), signal(AbortSignal) }
function recognizeByAIStream(dataUrl, handlers = {}) {
  const onItem = handlers.onItem || (() => {});
  const onMeta = handlers.onMeta || (() => {});
  const signal = handlers.signal;
  const workerUrl = (typeof localStorage !== 'undefined' && localStorage.getItem('ai_worker_url')) || AI_WORKER_URL;
  return new Promise((resolve, reject) => {
    if (!workerUrl) { reject(Object.assign(new Error('未配置 AI 服务'), { code: 'no_worker' })); return; }
    const controller = new AbortController();
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    // 流式按"数据间隔"计时：等首包最多 45 秒（含冷启动），之后 30 秒没新数据才超时
    let timer = null;
    const arm = (ms) => { clearTimeout(timer); timer = setTimeout(() => controller.abort(), ms); };
    let engine = 'qwen-ai';
    let count = 0;
    let settled = false;
    const finish = (fn, arg) => { if (settled) return; settled = true; clearTimeout(timer); fn(arg); };

    fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl }),
      signal: controller.signal,
    }).then(async (resp) => {
      const ctype = resp.headers.get('content-type') || '';
      // SSE 建立前的 JSON 错误（400/403/429/500）
      if (!resp.ok || ctype.indexOf('text/event-stream') === -1) {
        let data = null;
        try { data = await resp.json(); } catch (e) {}
        const code = (data && data.error) || 'upstream_error';
        const err = new Error(AI_ERROR_TEXT[code] || '识别失败，请重试');
        err.code = data && data.status ? (code + ':' + data.status) : code;
        throw err;
      }
      arm(45000);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        arm(30000);
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n')) >= 0) {
          let line = buf.slice(0, idx).replace(/\r$/, '');
          buf = buf.slice(idx + 1);
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          let evt;
          try { evt = JSON.parse(payload); } catch (e) { continue; }
          if (evt.type === 'meta') { if (evt.engine) { engine = evt.engine; onMeta(engine); } }
          else if (evt.type === 'item' && evt.item) { count++; onItem(evt.item); }
          else if (evt.type === 'done') { return finish(resolve, { engine, count: evt.count || count }); }
          else if (evt.type === 'error') {
            const err = new Error(AI_ERROR_TEXT[evt.code] || '识别失败，请重试');
            err.code = evt.status ? (evt.code + ':' + evt.status) : evt.code;
            throw err;
          }
        }
      }
      // 没有显式 done 事件：收到过结果也算成功，否则按解析失败处理
      if (count > 0) return finish(resolve, { engine, count });
      const err = new Error(AI_ERROR_TEXT.result_parse_failed);
      err.code = 'result_parse_failed';
      throw err;
    }).catch((err) => {
      // 用户主动取消 vs 超时（都是 AbortError），用外部 signal 区分
      if (err && err.name === 'AbortError') {
        const e = new Error(signal && signal.aborted ? '已取消识别' : '识别超时，请重试');
        e.code = signal && signal.aborted ? 'aborted' : 'timeout';
        return finish(reject, e);
      }
      if (err && err.code) return finish(reject, err);
      const e = new Error('网络连接失败，请检查网络后重试');
      e.code = 'network';
      finish(reject, e);
    });
  });
}

// 带离线兜底的流式识别（uploadFile 的流式替代）
// 网络/服务故障自动回退离线颜色估算；"没有食物"和"用户取消"不兜底
function uploadFileStream(filePath, handlers = {}) {
  const runOffline = () => extractImageFeatures(filePath).then(feat => new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const res = mockRequest('POST', '/api/scan', { features: feat });
        (res.items || []).forEach(it => handlers.onItem && handlers.onItem(it));
        resolve({ engine: 'local-fallback', count: (res.items || []).length });
      } catch (e) { reject(e); }
    }, 500);
  }));

  if (!MOCK_MODE) {
    // 非纯前端模式：退化为普通上传接口
    return uploadFile('/api/ai/recognize', filePath).then(res => {
      (res.items || []).forEach(it => handlers.onItem && handlers.onItem(it));
      return { engine: res.engine, count: (res.items || []).length };
    });
  }
  const workerUrl = (typeof localStorage !== 'undefined' && localStorage.getItem('ai_worker_url')) || AI_WORKER_URL;
  if (!workerUrl) return runOffline();
  return recognizeByAIStream(filePath, handlers).catch((err) => {
    const FALLBACK_PREFIX = ['network', 'timeout', 'no_worker', 'upstream_error', 'upstream_network', 'upstream_timeout', 'stream_failed', 'result_parse_failed', 'upstream_bad_json', 'server_key_missing'];
    const baseCode = String(err.code || '').split(':')[0];
    if (baseCode === 'aborted' || baseCode === 'no_food_detected') throw err;
    const canFallback = !err.code || FALLBACK_PREFIX.includes(baseCode);
    if (!canFallback) throw err;
    uni.showToast({ title: 'AI 服务暂不可达，已用离线估算', icon: 'none', duration: 2500 });
    return runOffline();
  });
}

function uploadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    if (MOCK_MODE) {
      const workerUrl = (typeof localStorage !== 'undefined' && localStorage.getItem('ai_worker_url')) || AI_WORKER_URL;
      if (workerUrl) {
        // 真实 AI 识别：网络/服务故障自动回退离线估算（不卡页面）；
        // "图片里没有食物"属于正常业务结果，直接报错不回退
        recognizeByAI(filePath)
          .then(resolve)
          .catch((err) => {
            const FALLBACK_PREFIX = ['network', 'timeout', 'no_worker', 'upstream_error', 'upstream_network', 'result_parse_failed', 'upstream_bad_json', 'server_key_missing'];
            const baseCode = String(err.code || '').split(':')[0];
            const canFallback = !err.code || FALLBACK_PREFIX.includes(baseCode);
            if (!canFallback) return reject(err);
            uni.showToast({ title: 'AI 服务暂不可达，已用离线估算', icon: 'none', duration: 2500 });
            extractImageFeatures(filePath).then(feat => {
              try {
                resolve({ ...mockRequest('POST', '/api/scan', { features: feat }), engine: 'local-fallback' });
              } catch (e) { reject(e); }
            });
          });
        return;
      }
      // 未配置 AI 服务：离线颜色启发式（结果仅供参考）
      extractImageFeatures(filePath).then(feat => {
        setTimeout(() => {
          try {
            const res = mockRequest('POST', '/api/scan', { features: feat });
            resolve({ ...res, engine: 'local-fallback' });
          } catch (err) {
            console.error('[mock] upload error:', err);
            reject(err);
          }
        }, 500);
      });
      return;
    }
    uni.uploadFile({
      url: (window.__BASE_URL__ || BASE_URL) + url,
      filePath: filePath,
      name: 'file',
      header: getToken() ? { 'Authorization': 'Bearer ' + getToken() } : {},
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
          else reject(data);
        } catch (e) { reject(e); }
      },
      fail: reject
    });
  });
}

const isAIEnabled = !!(AI_WORKER_URL || (typeof localStorage !== 'undefined' && localStorage.getItem('ai_worker_url')));

export { BASE_URL, request, uploadFile, uploadFileStream, recognizeByAIStream, isAIEnabled };
