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
  },
});
