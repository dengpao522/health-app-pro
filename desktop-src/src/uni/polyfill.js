// uni-app API polyfill for web/desktop

// ============ 安全工具 ============
// 所有经 innerHTML 渲染的动态文本必须转义，防止食物名等外部数据注入（XSS）
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ============ Storage ============
const storage = {
  getStorageSync(key) {
    try { return JSON.parse(localStorage.getItem(key)) } catch { return '' }
  },
  setStorageSync(key, data) { localStorage.setItem(key, JSON.stringify(data)) },
  removeStorageSync(key) { localStorage.removeItem(key) },
}

// ============ Toast / Loading ============
let toastTimer = null
let loadingEl = null

function showToast({ title, icon = 'none', duration = 2000 }) {
  if (toastTimer) clearTimeout(toastTimer)
  let el = document.getElementById('__uni_toast')
  if (!el) {
    el = document.createElement('div')
    el.id = '__uni_toast'
    el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.75);color:#fff;padding:24px 40px;border-radius:12px;font-size:16px;z-index:99999;pointer-events:none;max-width:80vw;text-align:center;'
    document.body.appendChild(el)
  }
  const iconHtml = icon === 'success' ? '<span style="font-size:42px;display:block;margin-bottom:8px;">✅</span>'
    : icon === 'error' ? '<span style="font-size:42px;display:block;margin-bottom:8px;">❌</span>'
    : ''
  el.innerHTML = iconHtml + esc(title)
  el.style.display = 'block'
  toastTimer = setTimeout(() => { el.style.display = 'none' }, duration)
}

function showLoading({ title = '加载中...' } = {}) {
  if (!loadingEl) {
    loadingEl = document.createElement('div')
    loadingEl.id = '__uni_loading'
    loadingEl.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);z-index:99998;display:flex;align-items:center;justify-content:center;'
    loadingEl.innerHTML = '<div style="background:rgba(0,0,0,0.8);color:#fff;padding:30px 48px;border-radius:16px;font-size:16px;">⏳ ' + title + '</div>'
    document.body.appendChild(loadingEl)
  } else {
    loadingEl.querySelector('div').textContent = '⏳ ' + title
    loadingEl.style.display = 'flex'
  }
}

function hideLoading() {
  if (loadingEl) loadingEl.style.display = 'none'
  // 双保险：按 id 再查一次，防止模块引用不一致时遮罩残留锁死页面
  const el = document.getElementById('__uni_loading')
  if (el) el.style.display = 'none'
}

// ============ Modal ============
function showModal({ title = '', content = '', success = () => {}, confirmText = '确定', cancelText = '取消' }) {
  const overlay = document.createElement('div')
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:99999;display:flex;align-items:center;justify-content:center;'
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:16px;width:300px;overflow:hidden;font-family:sans-serif;">
      <div style="padding:24px 24px 16px;text-align:center;">
        ${title ? '<div style="font-size:18px;font-weight:700;margin-bottom:8px;">' + esc(title) + '</div>' : ''}
        <div style="font-size:15px;color:#666;line-height:1.5;">${esc(content)}</div>
      </div>
      <div style="display:flex;border-top:1px solid #eee;">
        <button id="__modal_cancel" style="flex:1;border:none;background:none;padding:14px 0;font-size:16px;color:#999;cursor:pointer;">${cancelText}</button>
        <button id="__modal_confirm" style="flex:1;border:none;background:none;padding:14px 0;font-size:16px;color:#FF6B35;font-weight:700;cursor:pointer;border-left:1px solid #eee;">${confirmText}</button>
      </div>
    </div>`
  document.body.appendChild(overlay)
  // 点击遮罩区域关闭弹窗（点内容区不关闭）
  overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); success({ confirm: false, cancel: true }) } })
  overlay.querySelector('#__modal_cancel').onclick = () => { overlay.remove(); success({ confirm: false, cancel: true }) }
  overlay.querySelector('#__modal_confirm').onclick = () => { overlay.remove(); success({ confirm: true, cancel: false }) }
}

// ============ ActionSheet ============
function showActionSheet({ itemList = [], success = () => {} }) {
  const overlay = document.createElement('div')
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:99999;display:flex;align-items:flex-end;justify-content:center;'
  const items = itemList.map((label, i) =>
    `<div class="__action_item" data-idx="${i}" style="padding:16px 24px;font-size:16px;color:#333;cursor:pointer;text-align:center;">${esc(label)}</div>`
  ).join('<div style="height:1px;background:#eee;"></div>')
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:16px 16px 0 0;width:100%;max-width:420px;overflow:hidden;font-family:sans-serif;">
      ${items}
      <div style="height:8px;background:#f5f5f5;"></div>
      <div id="__action_cancel" style="padding:16px 24px;font-size:16px;color:#999;cursor:pointer;text-align:center;">取消</div>
    </div>`
  document.body.appendChild(overlay)
  overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); success({ tapIndex: -1 }) } })
  overlay.querySelectorAll('.__action_item').forEach(el => {
    el.onclick = () => { const idx = parseInt(el.dataset.idx); overlay.remove(); success({ tapIndex: idx }) }
  })
  overlay.querySelector('#__action_cancel').onclick = () => { overlay.remove(); success({ tapIndex: -1 }) }
}

// ============ Image Chooser ============
// 压缩图片并转成 dataURL：
// 1) blob: URL 在部分微信内置浏览器(X5/WKWebView)里 <img> 无法渲染
// 2) 控制体积，避免后续读取/存储时过大
function compressImage(file, maxSize = 1000, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        let w = img.naturalWidth || img.width
        let h = img.naturalHeight || img.height
        if (w > maxSize || h > maxSize) {
          const r = Math.min(maxSize / w, maxSize / h)
          w = Math.round(w * r); h = Math.round(h * r)
        }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        try {
          resolve(canvas.toDataURL('image/jpeg', quality))
        } catch (e) { reject(e) }
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

function chooseImage({ count = 1, success = () => {}, fail = () => {} } = {}) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.multiple = count > 1
  // 挂到 DOM 上：部分 WebView 对未挂载元素的 .click() 不响应
  input.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;'
  document.body.appendChild(input)
  const cleanup = () => { try { input.remove() } catch (e) {} }
  input.onchange = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) { cleanup(); return }
    Promise.all(files.map(f => compressImage(f)))
      .then(paths => { success({ tempFilePaths: paths, tempFiles: files }) })
      .catch(err => {
        // 极端情况兜底：退回 blob URL
        try {
          success({ tempFilePaths: files.map(f => URL.createObjectURL(f)), tempFiles: files })
        } catch (e2) { fail(err || e2) }
      })
      .then(cleanup)
  }
  input.click()
}

// ============ Canvas Context Polyfill ============
function createCanvasContext(canvasId, comp) {
  // 找到 canvas 元素
  let canvas = null
  if (comp && comp.$el) {
    canvas = comp.$el.querySelector(`[canvas-id="${canvasId}"]`)
  }
  if (!canvas) {
    canvas = document.querySelector(`[canvas-id="${canvasId}"]`)
  }
  if (!canvas) {
    console.warn(`Canvas not found: ${canvasId}`)
    return null
  }
  // 设置 canvas 实际尺寸
  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.max(1, Math.round(rect.width * dpr))
  canvas.height = Math.max(1, Math.round(rect.height * dpr))

  // 页面用“设计坐标”绘图（如 660x320），按元素实际 CSS 尺寸整体缩放，
  // 否则在不同屏宽下图形会溢出/被裁切。未声明 design-* 时按 CSS 像素 1:1。
  const dw = parseFloat(canvas.getAttribute('design-width')) || rect.width
  const dh = parseFloat(canvas.getAttribute('design-height')) || rect.height
  const sx = (rect.width / dw) * dpr
  const sy = (rect.height / dh) * dpr

  const ctx = canvas.getContext('2d')
  ctx.scale(sx, sy)

  // uni canvas API wrapper
  const wrapper = {
    _ctx: ctx,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    font: '14px sans-serif',
    textAlign: 'left',
    lineDashOffset: 0,

    setFillStyle(v) { this.fillStyle = v; ctx.fillStyle = v },
    setStrokeStyle(v) { this.strokeStyle = v; ctx.strokeStyle = v },
    setLineWidth(v) { this.lineWidth = v; ctx.lineWidth = v },
    setLineCap(v) { ctx.lineCap = v },
    setFontSize(v) { this.font = v + 'px sans-serif'; ctx.font = v + 'px sans-serif' },
    setTextAlign(v) { this.textAlign = v; ctx.textAlign = v },
    setLineDash(dash, offset) { ctx.setLineDash(dash); ctx.lineDashOffset = offset || 0 },

    fillStyle: '#000',
    strokeStyle: '#000',

    createLinearGradient(x0, y0, x1, y1) {
      return ctx.createLinearGradient(x0, y0, x1, y1)
    },

    beginPath() { ctx.beginPath() },
    closePath() { ctx.closePath() },
    moveTo(x, y) { ctx.moveTo(x, y) },
    lineTo(x, y) { ctx.lineTo(x, y) },
    arc(x, y, r, s, e) { ctx.arc(x, y, r, s, e) },
    arcTo(x1, y1, x2, y2, r) { ctx.arcTo(x1, y1, x2, y2, r) },
    fill() { ctx.fill() },
    stroke() { ctx.stroke() },
    clearRect(x, y, w, h) { ctx.clearRect(x, y, w, h) },
    fillText(t, x, y) { ctx.fillText(t, x, y) },
    save() { ctx.save() },
    restore() { ctx.restore() },
    translate(x, y) { ctx.translate(x, y) },
    rotate(a) { ctx.rotate(a) },
    scale(x, y) { ctx.scale(x, y) },
    clip() { ctx.clip() },

    draw() { /* no-op, canvas auto-renders */ },
  }

  // 让 getter 走 ctx
  Object.defineProperty(wrapper, 'fillStyle', {
    get() { return ctx.fillStyle },
    set(v) { ctx.fillStyle = v }
  })
  Object.defineProperty(wrapper, 'strokeStyle', {
    get() { return ctx.strokeStyle },
    set(v) { ctx.strokeStyle = v }
  })
  Object.defineProperty(wrapper, 'lineWidth', {
    get() { return ctx.lineWidth },
    set(v) { ctx.lineWidth = v }
  })
  Object.defineProperty(wrapper, 'font', {
    get() { return ctx.font },
    set(v) { ctx.font = v }
  })
  Object.defineProperty(wrapper, 'textAlign', {
    get() { return ctx.textAlign },
    set(v) { ctx.textAlign = v }
  })

  return wrapper
}

// ============ Navigation (delegated to vue-router) ============
function setRouter(r) { if (typeof window !== 'undefined') window.__uni_router = r }

// uni 风格路径(/pages/X/X?k=v) → vue-router 路由对象
// 旧实现用正则截掉最后一段时会把 ?k=v 一起截掉，导致详情页拿不到参数（食物详情页空白的根因）
function toRoute(url) {
  const q = url.indexOf('?');
  const path = url.slice(0, q < 0 ? url.length : q).replace('/pages/', '/').replace(/\/[^/]+$/, '');
  const query = {};
  if (q >= 0) new URLSearchParams(url.slice(q + 1)).forEach((v, k) => { query[k] = v });
  return { path, query };
}

const nav = {
  switchTab({ url }) {
    const router = (typeof window !== 'undefined') ? window.__uni_router : null
    if (router) router.push(toRoute(url))
  },
  navigateTo({ url }) {
    const router = (typeof window !== 'undefined') ? window.__uni_router : null
    if (router) router.push(toRoute(url))
  },
  navigateBack() {
    const router = (typeof window !== 'undefined') ? window.__uni_router : null
    if (router) router.back()
  },
  reLaunch({ url }) {
    const router = (typeof window !== 'undefined') ? window.__uni_router : null
    if (router) router.replace(toRoute(url))
  },
}

// ============ Request ============
function uniRequest({ url, method = 'GET', data = {}, header = {}, success = () => {}, fail = () => {} }) {
  const fullUrl = (window.__BASE_URL__ || '') + url
  fetch(fullUrl, {
    method,
    headers: { 'Content-Type': 'application/json', ...header },
    body: method !== 'GET' ? JSON.stringify(data) : undefined,
  })
    .then(async res => {
      const json = await res.json()
      const resp = { statusCode: res.status, data: json }
      if (res.ok) success(resp)
      else fail(resp)
    })
    .catch(err => fail(err))
}

// ============ Upload File ============
function uniUploadFile({ url, filePath, name = 'file', header = {}, success = () => {}, fail = () => {} }) {
  const fullUrl = (window.__BASE_URL__ || '') + url
  fetch(filePath)
    .then(r => r.blob())
    .then(blob => {
      const formData = new FormData()
      formData.append(name, blob, 'image.jpg')
      return fetch(fullUrl, { method: 'POST', headers: header, body: formData })
    })
    .then(async res => {
      const text = await res.text()
      try {
        const json = JSON.parse(text)
        success({ statusCode: res.status, data: JSON.stringify(json) })
      } catch {
        success({ statusCode: res.status, data: text })
      }
    })
    .catch(err => fail(err))
}

// ============ Export uni object ============
export const uni = {
  ...storage,
  showToast,
  showLoading,
  hideLoading,
  showModal,
  showActionSheet,
  chooseImage,
  createCanvasContext,
  ...nav,
  request: uniRequest,
  uploadFile: uniUploadFile,
  setRouter,
}

// 全局暴露
if (typeof window !== 'undefined') {
  window.uni = uni
}
