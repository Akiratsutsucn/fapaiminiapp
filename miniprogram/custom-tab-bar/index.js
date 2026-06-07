Component({
  data: {
    selected: 0,
  },

  methods: {
    switchTab(e) {
      const path = e.currentTarget.dataset.path;
      wx.switchTab({ url: path });
    },

    onAiSelect() {
      wx.showToast({
        title: 'AI选房功能开发中，敬请期待',
        icon: 'none',
        duration: 2000,
      });
    },
  },
});
