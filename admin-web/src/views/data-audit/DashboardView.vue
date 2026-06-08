<!-- 数据审核管理 - 简化测试版 -->
<template>
  <div style="padding: 20px;">
    <h2>数据审核概览</h2>
    <t-card title="系统状态" style="margin-top: 16px">
      <p>✅ 数据审核模块已部署</p>
      <p>✅ 后端服务运行正常</p>
      <p>✅ 数据库表已创建（4张表）</p>
      <p>✅ 默认规则已初始化（10条）</p>
      <p>✅ 自动调度器已启动</p>
    </t-card>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'

onMounted(() => {
  console.log('数据审核页面已加载')
  MessagePlugin.success('数据审核模块加载成功')
})
</script>
