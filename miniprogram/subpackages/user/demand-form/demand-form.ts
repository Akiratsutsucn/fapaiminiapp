import { submitDemand } from '../../../services/demand';
Page({
  data: { form: { name: '', gender: 1, phone: '', city: '', purpose: '自住', budget: '', own_funds: '', target_district: '' }, submitting: false },
  onFieldInput(e: any) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },
  onRadioChange(e: any) {
    const { field, value } = e.currentTarget.dataset;
    const v = parseInt(value);
    if (field) this.setData({ [`form.${field}`]: value });
    else this.setData({ 'form.gender': v });
  },
  async onSubmit() {
    const f = this.data.form;
    if (!f.name || !f.phone || !f.city || !f.purpose || !f.budget || !f.target_district) {
      wx.showToast({ title: '请填写必填项', icon: 'none' }); return;
    }
    if (f.phone.length !== 11) { wx.showToast({ title: '手机号格式错误', icon: 'none' }); return; }
    this.setData({ submitting: true });
    try {
      await submitDemand(f as DemandForm);
      wx.showToast({ title: '提交成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (e) {
      this.setData({ submitting: false });
    }
  },
});
