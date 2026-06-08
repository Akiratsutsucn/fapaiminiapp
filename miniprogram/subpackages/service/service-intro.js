Page({
  data: {},

  onLoad(options) {
    wx.setNavigationBarTitle({
      title: '专业服务'
    });
  },

  /**
   * 联系客服
   */
  onContactService() {
    wx.navigateTo({
      url: '/pages/customer-service/customer-service'
    });
  },

  /**
   * 填写需求
   */
  onFillDemand() {
    wx.navigateTo({
      url: '/subpackages/user/demand-form/demand-form'
    });
  }
});
