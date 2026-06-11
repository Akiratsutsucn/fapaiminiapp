<template>
  <div class="dashboard">
    <div class="page-header">
      <h2 class="page-title">数据看板</h2>
      <t-select v-model="cityId" style="width: 160px" @change="loadDashboard">
        <t-option :value="0" label="全部" />
        <t-option :value="310000" label="上海" />
        <t-option :value="330200" label="宁波" />
        <t-option :value="330100" label="杭州" />
      </t-select>
    </div>
    <t-row :gutter="16" class="stat-cards">
      <t-col :span="3" v-for="card in cards" :key="card.label">
        <t-card :title="card.label" hover-shadow>
          <div class="stat-value">{{ card.value }}</div>
          <t-collapse v-if="card.cityBreakdown && card.cityBreakdown.length > 0 && cityId === 0" style="margin-top: 12px">
            <t-collapse-panel header="城市明细">
              <div class="city-breakdown">
                <div v-for="city in card.cityBreakdown" :key="city.name" class="city-item">
                  <span class="city-name">{{ city.name }}</span>
                  <span class="city-value">{{ city.value }}</span>
                </div>
              </div>
            </t-collapse-panel>
          </t-collapse>
        </t-card>
      </t-col>
    </t-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getDashboard } from '@/api/dashboard'

const cityId = ref(0)  // 0=全部, 310000=上海, 330200=宁波
const cards = ref([
  { label: '入数据库总房源数', value: 0, cityBreakdown: [] as any[] },
  { label: '今日入库房源数', value: 0, cityBreakdown: [] as any[] },
  { label: '即将开拍（与小程序同步）', value: 0, cityBreakdown: [] as any[] },
  { label: '捡漏房源（与小程序同步）', value: 0, cityBreakdown: [] as any[] },
  { label: '昨日上架（与小程序同步）', value: 0, cityBreakdown: [] as any[] },
  { label: '昨日成交（与小程序同步）', value: 0, cityBreakdown: [] as any[] },
  { label: '累计已成交', value: 0, cityBreakdown: [] as any[] },
  { label: '拍卖进行中数量', value: 0, cityBreakdown: [] as any[] },
  { label: '待处理需求', value: 0, cityBreakdown: [] as any[] },
  { label: '待处理留言', value: 0, cityBreakdown: [] as any[] },
  { label: '注册用户', value: 0, cityBreakdown: [] as any[] },
  { label: '总文章数', value: 0, cityBreakdown: [] as any[] },
])

async function loadDashboard() {
  try {
    const data: any = await getDashboard(cityId.value || undefined)

    // 城市key映射
    const cityKeyNames: Record<string, string> = {
      shanghai: '上海',
      ningbo: '宁波',
      hangzhou: '杭州'
    }

    // 辅助函数：从后端返回的数据中提取值和城市分项
    function parseMetric(metricData: any) {
      if (typeof metricData === 'object' && metricData.total !== undefined) {
        // 带 by_city 的指标：{ total: xxx, by_city: { shanghai: xxx, ningbo: xxx, hangzhou: xxx } }
        const cityBreakdown = metricData.by_city ? Object.keys(metricData.by_city).map(cityKey => ({
          name: cityKeyNames[cityKey] || cityKey,
          value: metricData.by_city[cityKey]
        })) : []
        return { value: metricData.total, cityBreakdown }
      } else {
        // 不带 by_city 的指标：直接是数字
        return { value: metricData || 0, cityBreakdown: [] }
      }
    }

    // 更新卡片数据（顺序须与上方 cards 定义一一对应）
    const metrics = [
      parseMetric(data.total_properties),      // 如数据库总房源数
      parseMetric(data.today_new),             // 今日入库房源数
      parseMetric(data.upcoming),              // 即将开拍（与小程序同步）
      parseMetric(data.bargain_count),         // 捡漏房源（与小程序同步）
      parseMetric(data.yesterday_listed),      // 昨日上架（与小程序同步）
      parseMetric(data.yesterday_sold),        // 昨日成交（与小程序同步）
      parseMetric(data.sold),                  // 累计已成交
      parseMetric(data.in_progress),           // 拍卖进行中数量
      parseMetric(data.pending_demands),       // 待处理需求
      parseMetric(data.pending_messages),      // 待处理留言
      parseMetric(data.total_users),           // 注册用户
      parseMetric(data.total_articles),        // 总文章数
    ]

    metrics.forEach((metric, index) => {
      cards.value[index].value = metric.value
      cards.value[index].cityBreakdown = metric.cityBreakdown
    })
  } catch { /* skip */ }
}

onMounted(async () => {
  loadDashboard()
})
</script>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.page-title { font-size: 20px; font-weight: 600; color: #1a1a1a; margin: 0; }
.stat-value { font-size: 32px; font-weight: 700; color: #2d4a7a; text-align: center; padding: 16px 0; }

.city-breakdown {
  padding: 8px 0;
}

.city-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 14px;
}

.city-name {
  color: #666;
}

.city-value {
  font-weight: 600;
  color: #0052d9;
}
</style>
