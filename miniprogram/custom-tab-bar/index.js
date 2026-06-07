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
      wx.navigateTo({
        url: '/pages/ai-search/ai-search',
      });
    },
  },
});
