<template>
  <view class="page">
    <view class="top-bar">
      <text class="page-title">拍照识别</text>
      <text class="page-sub">对准饭菜，AI 自动识别营养</text>
    </view>

    <!-- 拍照/选图 -->
    <view class="upload-area" @click="chooseImage">
      <block v-if="!imagePath">
        <text class="up-icon">📷</text>
        <text class="up-text">点击拍照或从相册选择</text>
        <text class="up-hint">支持识别中餐、西餐、水果、饮料等</text>
      </block>
      <img v-if="imagePath" :src="imagePath" class="preview-img" alt="菜品照片" />
      <view v-if="imagePath" class="reupload" @click.stop="chooseImage">重新选择</view>
    </view>

    <!-- 识别中、还没有结果时的大 loading（有结果后状态条移到结果卡片内） -->
    <view v-if="recognizing && !items.length" class="loading">
      <text class="spin">🤖</text>
      <text>{{ recognizingText }}</text>
      <text class="cancel-link" @click="cancelRecognize">取消</text>
    </view>

    <!-- 识别失败 -->
    <view v-if="recognizeError && !recognizing" class="error-card">
      <text class="err-icon">😵</text>
      <text class="err-text">{{ recognizeError }}</text>
      <view class="err-btns">
        <button class="retry-btn" @click="recognize">重新识别</button>
        <button class="offline-btn" @click="fallbackOffline">离线估算</button>
      </view>
    </view>

    <!-- 识别结果（流式：识别过程中已认出的菜品实时显示） -->
    <view v-if="items.length" class="result-card">
      <view class="result-head">
        <text class="result-title">识别结果（{{ items.length }} 项{{ recognizing ? '，识别中…' : '' }}）</text>
        <text v-if="engine" class="engine" :class="engineClass">{{ engineLabel }}</text>
      </view>
      <view v-if="recognizing" class="stream-bar">
        <text class="spin spin-sm">🤖</text>
        <text class="stream-text">{{ recognizingText }}</text>
        <text class="cancel-link inline" @click="cancelRecognize">取消</text>
      </view>
      <view v-if="!recognizing" class="select-row" @click="toggleAll">
        <view class="check" :class="{ on: allChecked }">{{ allChecked ? '✓' : '' }}</view>
        <text class="select-all">{{ allChecked ? '取消全选' : '全选' }}</text>
        <text class="tip-text">勾选要吃的菜品，可调分量</text>
      </view>
      <view class="food-list">
        <view v-for="(it,idx) in items" :key="idx" class="food-item" :class="{ saved: it.saved, off: !it.checked && !it.saved }">
          <view class="food-main">
            <view class="check" :class="{ on: it.checked || it.saved }" @click.stop="toggle(it)">{{ (it.checked || it.saved) ? '✓' : '' }}</view>
            <view class="food-info">
              <view class="food-name-row">
                <text class="food-name">{{ it.name }}</text>
                <text class="food-cat">{{ it.category }}</text>
                <text v-if="it.saved" class="saved-tag">已添加</text>
                <text v-else-if="it.confidence < 0.65" class="low-conf">可能不准</text>
              </view>
              <view class="food-nut">
                <text>🔥 {{ it.calories }} kcal/100g</text>
                <text>🥩 {{ it.protein }}g</text>
                <text>🥑 {{ it.fat }}g</text>
                <text>🍚 {{ it.carbs }}g</text>
              </view>
              <view class="food-act">
                <text class="hint">分量</text>
                <input type="number" v-model="it.serving" class="serving-input" :disabled="it.saved || recognizing" @blur="clampServing(it)" />
                <text class="hint">{{ it.serving_hint }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 手动搜索 -->
    <view class="search-card">
      <view class="search-row">
        <text class="s-icon">🔍</text>
        <input v-model="keyword" placeholder="没识别对？搜索食物手动添加" @keyup.enter="doSearch" @input="onSearchInput" />
        <text v-if="keyword" class="clear-btn" @click="keyword=''; searchResults=[]">✕</text>
      </view>
      <view v-if="searching" class="search-hint">搜索中...</view>
      <view v-if="searchResults.length" class="search-list">
        <view v-for="f in searchResults" :key="f.name" class="s-item" @click="pickSearch(f)">
          <view class="s-left" @click.stop="viewFoodDetail(f.name)">
            <text class="s-name">{{ f.name }} <text class="s-detail-hint">详情 ›</text></text>
            <text class="s-cat">{{ f.category }} · {{ f.calories }}kcal/100g</text>
          </view>
          <text class="s-add" @click.stop="pickSearch(f)">+</text>
        </view>
      </view>
      <view v-if="!searching && keyword && searchResults.length===0 && searched" class="search-hint">没有找到相关食物</view>
    </view>

    <view class="bottom-holder"></view>

    <!-- 底部统一保存栏 -->
    <view v-if="items.length && !recognizing" class="save-bar">
      <view class="save-info">
        <text class="save-count">已选 {{ selectedItems.length }} 项</text>
        <text class="save-kcal">合计约 {{ totalCal }} kcal</text>
      </view>
      <button v-if="!allSaved" class="save-btn" :disabled="saving || !selectedItems.length" @click="saveAll">
        {{ saving ? '保存中...' : '保 存' }}
      </button>
      <button v-else class="save-btn done" @click="goHome">已保存 · 返回今日</button>
    </view>
  </view>
</template>

<script>
import { request, uploadFileStream, isAIEnabled } from '../js/request.js';
const MEAL_TYPES = [
  { key: 'breakfast', name: '早餐' },
  { key: 'lunch', name: '午餐' },
  { key: 'dinner', name: '晚餐' },
  { key: 'snack', name: '加餐' },
];
export default {
  data() {
    return {
      imagePath: '',
      recognizing: false,
      recognizingText: '',
      _abortCtrl: null,
      saving: false,
      items: [],
      engine: '',
      aiEnabled: isAIEnabled,
      recognizeError: '',
      keyword: '',
      searchResults: [],
      searching: false,
      searched: false,
      _searchTimer: null,
    };
  },
  computed: {
    selectedItems() { return this.items.filter(i => i.checked && !i.saved); },
    totalCal() {
      return this.selectedItems.reduce((sum, it) => {
        const s = parseFloat(it.serving) || 0;
        return sum + it.calories * s / 100;
      }, 0).toFixed(0);
    },
    allChecked() {
      const editable = this.items.filter(i => !i.saved);
      return editable.length > 0 && editable.every(i => i.checked);
    },
    allSaved() { return this.items.length > 0 && this.items.every(i => i.saved); },
    engineLabel() { return this.engine && this.engine !== 'local-fallback' ? 'AI 视觉识别' : '离线估算（仅供参考）'; },
    engineClass() { return this.engine && this.engine !== 'local-fallback' ? '' : 'local-fallback'; },
  },
  methods: {
    chooseImage() {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          this.imagePath = res.tempFilePaths[0];
          this.items = [];
          this.recognizeError = '';
          this.recognize();
        }
      });
    },
    async recognize() {
      this.recognizing = true;
      this.recognizingText = this.aiEnabled ? 'AI 正在识别中，预计 10~30 秒...' : '离线估算中...';
      this.recognizeError = '';
      this.items = [];
      this.engine = '';
      this._abortCtrl = new AbortController();
      try {
        const res = await uploadFileStream(this.imagePath, {
          signal: this._abortCtrl.signal,
          onMeta: (engine) => { this.engine = engine; },
          onItem: (it) => {
            this.items.push({
              ...it,
              serving: it.suggested_serving || 100,
              checked: true,
              saved: false,
            });
            this.recognizingText = `AI 正在识别中，已认出 ${this.items.length} 项...`;
            // 新菜品出现后自动滚到可视区（已在可视区内则不会跳动）
            this.$nextTick(() => {
              try {
                const els = this.$el && this.$el.querySelectorAll ? this.$el.querySelectorAll('.food-item') : [];
                const last = els[els.length - 1];
                if (last && last.scrollIntoView) last.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              } catch (err) {}
            });
          },
        });
        this.engine = res.engine;
      } catch (e) {
        const code = String((e && e.code) || '').split(':')[0];
        if (code === 'aborted') {
          // 用户取消：已收到的部分结果保留在列表里，可手动勾选保存
          if (this.items.length) {
            uni.showToast({ title: `已取消，保留已识别的 ${this.items.length} 项`, icon: 'none', duration: 2500 });
          } else {
            this.recognizeError = '已取消识别';
          }
          return;
        }
        // 中断前已收到部分结果：保留，不清空
        const KEEP_PARTIAL = ['timeout', 'network', 'stream_failed', 'upstream_network', 'upstream_timeout'];
        if (this.items.length && KEEP_PARTIAL.includes(code)) {
          uni.showToast({ title: '连接中断，已保留部分识别结果', icon: 'none', duration: 2500 });
          return;
        }
        this.recognizeError = (e && e.message) ? e.message : '识别失败，请重试';
      } finally {
        this.recognizing = false;
        this._abortCtrl = null;
      }
    },
    cancelRecognize() {
      if (this._abortCtrl) { try { this._abortCtrl.abort(); } catch(e) {} }
    },
    async fallbackOffline() {
      this.recognizeError = '';
      this.recognizing = true;
      this.recognizingText = '离线估算中...';
      try {
        // 直接用离线 mock，不走 AI
        const { extractImageFeatures } = await import('../js/request.js');
        const feat = await extractImageFeatures(this.imagePath);
        // 动态导入 mock
        const mockModule = await import('../js/mock.js');
        const res = mockModule.mockRequest('POST', '/api/scan', { features: feat });
        this.items = (res.items || []).map(it => ({
          ...it,
          serving: it.suggested_serving || 100,
          checked: true, saved: false,
        }));
        this.engine = 'local-fallback';
      } catch (e) {
        this.recognizeError = '离线估算失败，请手动搜索添加';
      } finally {
        this.recognizing = false;
      }
    },
    clampServing(it) {
      let v = parseFloat(it.serving);
      if (!v || v < 1) v = 100;
      if (v > 2000) v = 2000;
      it.serving = Math.round(v);
    },
    toggle(it) {
      if (it.saved) return;
      it.checked = !it.checked;
    },
    toggleAll() {
      const target = !this.allChecked;
      this.items.forEach(i => { if (!i.saved) i.checked = target; });
    },
    onSearchInput() {
      this.searched = false;
      if (this._searchTimer) clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => { this.doSearch(); }, 350);
    },
    async doSearch() {
      if (!this.keyword.trim()) { this.searchResults = []; this.searched = false; return; }
      this.searching = true;
      try {
        this.searchResults = await request({ url: '/api/meals/foods/search', data: { keyword: this.keyword } });
      } catch (e) { this.searchResults = []; }
      this.searching = false;
      this.searched = true;
    },
    pickSearch(f) {
      const it = { ...f, serving: 100, serving_hint: f.serving_hint || '约 100g', confidence: 1, checked: true, saved: false };
      this.items.unshift(it);
      this.keyword = '';
      this.searchResults = [];
      this.searched = false;
    },
    // 查看食物详情（评分/NRV/营养点评）
    viewFoodDetail(name) {
      uni.navigateTo({ url: '/pages/food-detail/food-detail?name=' + encodeURIComponent(name) });
    },
    saveAll() {
      const picks = this.selectedItems;
      if (!picks.length || this.saving) return;
      uni.showActionSheet({
        itemList: MEAL_TYPES.map(m => m.name),
        success: (res) => {
          if (res.tapIndex < 0) return;
          this.doSave(picks, MEAL_TYPES[res.tapIndex]);
        }
      });
    },
    async doSave(picks, meal) {
      this.saving = true;
      uni.showLoading({ title: '保存中...' });
      try {
        await Promise.all(picks.map(it => {
          const serving = parseFloat(it.serving) || 100;
          const ratio = serving / 100;
          return request({
            url: '/api/meals',
            method: 'POST',
            data: {
              food_name: it.name,
              meal_type: meal.key,
              serving_size: serving,
              calories: +(it.calories * ratio).toFixed(1),
              protein: +(it.protein * ratio).toFixed(1),
              fat: +(it.fat * ratio).toFixed(1),
              carbs: +(it.carbs * ratio).toFixed(1),
              fiber: +((it.fiber || 0) * ratio).toFixed(1),
              sodium: +((it.sodium || 0) * ratio).toFixed(1),
              confidence: it.confidence || 0,
            }
          });
        }));
        picks.forEach(it => { it.saved = true; it.checked = false; });
        uni.showToast({ title: `已添加 ${picks.length} 项到${meal.name}`, icon: 'success' });
      } catch (e) {
        uni.showToast({ title: (e && e.message) ? e.message : '保存失败，请重试', icon: 'none' });
      } finally {
        this.saving = false;
        uni.hideLoading();
      }
    },
    goHome() { uni.switchTab({ url: '/pages/home/home' }); },
  }
}
</script>

<style>
.page { min-height: 100vh; background: #F5F6FA; }
.top-bar { padding: 100rpx 32rpx 30rpx; background: linear-gradient(160deg, #FF6B35, #FF8F5E); color: #fff; }
.page-title { display: block; font-size: 44rpx; font-weight: 800; }
.page-sub { display: block; font-size: 26rpx; opacity: 0.9; margin-top: 8rpx; }

.upload-area { margin: 24rpx; background: #fff; border-radius: 24rpx; height: 360rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2rpx dashed #FFB088; position: relative; overflow: hidden; }
.up-icon { font-size: 100rpx; }
.up-text { font-size: 30rpx; color: #FF6B35; font-weight: 600; margin-top: 16rpx; }
.up-hint { font-size: 24rpx; color: #999; margin-top: 12rpx; }
.preview-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.reupload { position: absolute; bottom: 20rpx; right: 20rpx; background: rgba(0,0,0,0.6); color: #fff; padding: 10rpx 24rpx; border-radius: 30rpx; font-size: 24rpx; }

.loading { text-align: center; padding: 40rpx; color: #FF6B35; font-size: 28rpx; }
.spin { display: inline-block; font-size: 56rpx; margin-right: 16rpx; animation: spin 1.5s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.cancel-link { display: block; margin-top: 16rpx; color: #999; font-size: 26rpx; text-decoration: underline; }

/* 流式识别中的紧凑状态条 */
.stream-bar { display: flex; align-items: center; gap: 12rpx; padding: 12rpx 0 20rpx; border-bottom: 1rpx solid #f5f5f5; }
.spin-sm { font-size: 36rpx; margin-right: 0; }
.stream-text { flex: 1; font-size: 26rpx; color: #FF6B35; }
.cancel-link.inline { margin-top: 0; white-space: nowrap; }

.error-card { margin: 0 24rpx 24rpx; background: #fff; border-radius: 24rpx; padding: 48rpx 32rpx; display: flex; flex-direction: column; align-items: center; }
.err-icon { font-size: 72rpx; }
.err-text { font-size: 27rpx; color: #666; margin-top: 20rpx; text-align: center; line-height: 1.6; }
.err-btns { display: flex; gap: 20rpx; margin-top: 32rpx; }
.retry-btn { background: #FF6B35; color: #fff; border: none; border-radius: 40rpx; font-size: 28rpx; padding: 0 48rpx; height: 76rpx; line-height: 76rpx; }
.offline-btn { background: #f5f5f5; color: #666; border: none; border-radius: 40rpx; font-size: 28rpx; padding: 0 48rpx; height: 76rpx; line-height: 76rpx; }

.result-card { margin: 0 24rpx 24rpx; background: #fff; border-radius: 24rpx; padding: 32rpx; }
.result-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.result-title { font-size: 32rpx; font-weight: 700; }
.engine { font-size: 22rpx; padding: 6rpx 16rpx; border-radius: 20rpx; background: #FFF0E8; color: #FF6B35; }
.engine.local-fallback { background: #f0f0f0; color: #999; }

.select-row { display: flex; align-items: center; padding: 12rpx 0 20rpx; border-bottom: 1rpx solid #f5f5f5; }
.select-all { font-size: 26rpx; color: #FF6B35; font-weight: 600; margin-left: 12rpx; }
.tip-text { font-size: 22rpx; color: #aaa; margin-left: auto; }

.check { width: 40rpx; height: 40rpx; min-width: 40rpx; border-radius: 50%; border: 2rpx solid #cfcfcf; display: flex; align-items: center; justify-content: center; font-size: 26rpx; color: #fff; background: #fff; }
.check.on { background: #FF6B35; border-color: #FF6B35; }

.food-list { }
.food-item { padding: 20rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.food-item:last-child { border-bottom: none; }
.food-item.off .food-info { opacity: 0.4; }
.food-item.saved { opacity: 0.55; }
.food-main { display: flex; align-items: flex-start; }
.food-info { flex: 1; margin-left: 16rpx; }
.food-name-row { display: flex; align-items: center; }
.food-name { font-size: 30rpx; font-weight: 700; color: #333; }
.food-cat { font-size: 22rpx; color: #999; margin-left: 12rpx; background: #f5f5f5; padding: 2rpx 12rpx; border-radius: 10rpx; }
.saved-tag { font-size: 20rpx; color: #fff; background: #34c759; padding: 2rpx 12rpx; border-radius: 10rpx; margin-left: 12rpx; }
.low-conf { font-size: 20rpx; color: #e6a23c; background: #fdf6ec; padding: 2rpx 12rpx; border-radius: 10rpx; margin-left: 12rpx; }
.food-nut { display: flex; flex-wrap: wrap; gap: 20rpx; margin-top: 12rpx; font-size: 24rpx; color: #666; }
.food-act { display: flex; align-items: center; margin-top: 16rpx; gap: 16rpx; }
.hint { font-size: 22rpx; color: #999; }
.serving-input { width: 120rpx; height: 60rpx; background: #f5f5f5; border-radius: 12rpx; text-align: center; font-size: 28rpx; }

.search-card { margin: 0 24rpx; background: #fff; border-radius: 24rpx; padding: 24rpx 32rpx; }
.search-row { display: flex; align-items: center; background: #f5f5f5; border-radius: 30rpx; padding: 0 24rpx; height: 72rpx; }
.s-icon { margin-right: 12rpx; font-size: 30rpx; }
.search-row input { flex: 1; font-size: 28rpx; }
.clear-btn { font-size: 28rpx; color: #999; padding: 0 8rpx; }
.search-hint { text-align: center; color: #aaa; font-size: 24rpx; padding: 16rpx 0; }
.search-list { margin-top: 16rpx; }
.s-item { display: flex; justify-content: space-between; align-items: center; padding: 18rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.s-detail-hint { font-size: 18rpx; color: #8AB4FF; font-weight: 400; }
.s-name { display: block; font-size: 28rpx; font-weight: 600; color: #333; }
.s-cat { display: block; font-size: 22rpx; color: #999; margin-top: 4rpx; }
.s-add { font-size: 40rpx; color: #FF6B35; font-weight: 300; }

.bottom-holder { height: 220rpx; }
.save-bar { position: fixed; left: 0; right: 0; bottom: 120rpx; max-width: 420px; margin: 0 auto; background: #fff; padding: 16rpx 24rpx; display: flex; align-items: center; box-shadow: 0 -4rpx 20rpx rgba(0,0,0,0.08); z-index: 99; }
.save-info { display: flex; flex-direction: column; }
.save-count { font-size: 26rpx; color: #333; font-weight: 600; }
.save-kcal { font-size: 22rpx; color: #999; margin-top: 4rpx; }
.save-btn { margin-left: auto; background: #FF6B35; color: #fff; border: none; border-radius: 40rpx; font-size: 30rpx; font-weight: 700; padding: 0 56rpx; height: 80rpx; line-height: 80rpx; }
.save-btn[disabled] { background: #ffc7a8; color: #fff; }
.save-btn.done { background: #34c759; }
</style>
