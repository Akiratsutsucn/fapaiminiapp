Component({
  properties: {
    images: { type: Array, value: [] as PropertyImage[] },
    autoplay: { type: Boolean, value: true },
  },
  data: { current: 0 },
  methods: {
    onSwiperChange(e: WechatMiniprogram.SwiperChange) {
      this.setData({ current: e.detail.current });
    },
    onImageError() {
      // 单张图片加载失败时静默忽略，避免控制台报错刷屏。
    },
  },
});
