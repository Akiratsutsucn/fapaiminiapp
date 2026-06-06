"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const demand_1 = require("../../../services/demand");
const plugin = requirePlugin("WechatSI");
const recordManager = plugin.getRecordRecognitionManager();
Page({
    data: { form: { name: '', gender: 1, phone: '', city: '', purpose: '自住', budget: '', own_funds: '', target_district: '', voice_text: '' }, submitting: false, recording: false },
    onLoad() {
        this.initRecord();
    },
    initRecord() {
        recordManager.onStart = () => {
            this.setData({ recording: true });
        };
        recordManager.onStop = (res) => {
            this.setData({ recording: false });
            const text = (res && res.result) || '';
            if (text) {
                // 追加到已有识别结果后面
                const prev = this.data.form.voice_text;
                this.setData({ 'form.voice_text': prev ? `${prev} ${text}` : text });
            }
            else {
                wx.showToast({ title: '没听清，请再说一次', icon: 'none' });
            }
        };
        recordManager.onError = (err) => {
            this.setData({ recording: false });
            console.error('语音识别失败:', err);
            wx.showToast({ title: '识别失败，请重试', icon: 'none' });
        };
    },
    onVoiceStart() {
        recordManager.start({ duration: 60000, lang: 'zh_CN' });
    },
    onVoiceEnd() {
        if (this.data.recording) {
            recordManager.stop();
        }
    },
    onFieldInput(e) {
        const field = e.currentTarget.dataset.field;
        this.setData({ [`form.${field}`]: e.detail.value });
    },
    onRadioChange(e) {
        const { field, value } = e.currentTarget.dataset;
        const v = parseInt(value);
        if (field)
            this.setData({ [`form.${field}`]: value });
        else
            this.setData({ 'form.gender': v });
    },
    async onSubmit() {
        const f = this.data.form;
        if (!f.name || !f.phone || !f.city || !f.purpose || !f.budget || !f.target_district) {
            wx.showToast({ title: '请填写必填项', icon: 'none' });
            return;
        }
        if (f.phone.length !== 11) {
            wx.showToast({ title: '手机号格式错误', icon: 'none' });
            return;
        }
        this.setData({ submitting: true });
        try {
            await (0, demand_1.submitDemand)(f);
            wx.showToast({ title: '提交成功', icon: 'success' });
            setTimeout(() => wx.navigateBack(), 1500);
        }
        catch (e) {
            this.setData({ submitting: false });
        }
    },
});
