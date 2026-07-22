// 隐私授权弹窗组件：把它放在任何会调用隐私接口(剪贴板)的页面上。
// 组件在 attached 时注册 wx.onNeedPrivacyAuthorization：微信在首次调用隐私接口
// 前回调本组件弹窗，用户点"同意"(open-type=agreePrivacyAuthorization)后放行，
// 本次运行期内不再弹。用法：页面 wxml 加 <privacy-popup />。
Component({
  data: { visible: false },
  lifetimes: {
    attached() {
      if ((wx as any).onNeedPrivacyAuthorization) {
        (wx as any).onNeedPrivacyAuthorization((resolve: (res: { event: string }) => void) => {
          (this as any)._resolve = resolve;
          this.setData({ visible: true });
        });
      }
    },
  },
  methods: {
    onAgree() {
      this.setData({ visible: false });
      const r = (this as any)._resolve;
      if (r) {
        r({ event: 'agree' });
        (this as any)._resolve = null;
      }
    },
    onReject() {
      this.setData({ visible: false });
      const r = (this as any)._resolve;
      if (r) {
        r({ event: 'disagree' });
        (this as any)._resolve = null;
      }
    },
    onOpenPrivacy() {
      if ((wx as any).openPrivacyContract) {
        (wx as any).openPrivacyContract({
          fail: () => wx.navigateTo({ url: '/pages/privacy/privacy' }),
        });
      } else {
        wx.navigateTo({ url: '/pages/privacy/privacy' });
      }
    },
    noop() {},
  },
});
