<template>
  <v-card :loading="loading">
    <v-tabs v-model="tab" align-tabs="center"><v-tab value="usage">User usage</v-tab><v-tab value="stats">Traffic trends</v-tab></v-tabs>
    <v-card-text>
      <v-row dense>
        <v-col cols="12" md="3"><v-text-field v-model="search" label="Search" prepend-inner-icon="mdi-magnify" clearable @keyup.enter="load" /></v-col>
        <v-col cols="12" md="2"><v-text-field v-model="tag" :label="tab === 'usage' ? 'User' : 'Tag'" clearable @keyup.enter="load" /></v-col>
        <v-col v-if="tab === 'stats'" cols="12" md="2"><v-select v-model="resource" label="Resource" :items="resources" /></v-col>
        <v-col cols="12" md="2"><v-text-field v-model="start" label="From" type="date" /></v-col>
        <v-col cols="12" md="2"><v-text-field v-model="end" label="To" type="date" /></v-col>
        <v-col cols="12" md="1" class="d-flex align-center"><v-btn block color="primary" @click="load">Apply</v-btn></v-col>
      </v-row>
      <v-window v-model="tab">
        <v-window-item value="usage">
          <v-row class="my-1"><v-col v-for="summary in summaries" :key="summary.label" cols="12" sm="4"><v-card variant="tonal"><v-card-text><div class="text-medium-emphasis">{{ summary.label }}</div><div class="text-h6" :class="summary.color">{{ bytes(summary.value) }}</div></v-card-text></v-card></v-col></v-row>
          <v-table density="comfortable" hover><thead><tr><th>User</th><th>Group</th><th>Upload</th><th>Download</th><th>Total</th><th>Quota</th><th>Online</th></tr></thead><tbody><tr v-for="item in usageItems" :key="item.user"><td>{{ item.user }}</td><td>{{ item.group || '—' }}</td><td class="text-orange">{{ bytes(item.upload) }}</td><td class="text-green">{{ bytes(item.download) }}</td><td>{{ bytes(item.total) }}</td><td>{{ bytes(item.quota) }}</td><td><v-icon :color="item.online ? 'success' : 'disabled'" icon="mdi-circle" size="small" /></td></tr></tbody></v-table>
        </v-window-item>
        <v-window-item value="stats">
          <v-card variant="outlined" class="mt-4"><v-card-text style="height: 420px"><Line v-if="chartData.labels.length" :data="chartData" :options="chartOptions" /><v-alert v-else type="info" variant="tonal">No matching traffic data</v-alert></v-card-text></v-card>
        </v-window-item>
      </v-window>
    </v-card-text>
  </v-card>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Line } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js'
import HttpUtils from '@/plugins/httputil'
import { HumanReadable } from '@/plugins/utils'
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

const tab = ref('usage'), loading = ref(false), search = ref(''), tag = ref(''), resource = ref('user')
const start = ref(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)), end = ref(new Date().toISOString().slice(0, 10))
const usageItems = ref<any[]>([]), statItems = ref<any[]>([]), usage = ref<any>({ upload: 0, download: 0 })
const resources = [{ title: 'User', value: 'user' }, { title: 'Inbound', value: 'inbound' }, { title: 'Outbound', value: 'outbound' }, { title: 'Endpoint', value: 'endpoint' }, { title: 'All', value: 'all' }]
const unix = (value: string, last = false) => Math.floor(new Date(`${value}T${last ? '23:59:59' : '00:00:00'}`).getTime() / 1000)
const load = async () => {
  loading.value = true
  const endpoint = tab.value === 'usage' ? 'api/analytics-usage' : 'api/analytics-stats'
  const response = await HttpUtils.get(endpoint, { search: search.value, start: unix(start.value), end: unix(end.value, true), limit: 2000, ...(tab.value === 'usage' ? { user: tag.value } : { tag: tag.value, resource: resource.value }) })
  if (response.success) {
    if (tab.value === 'usage') { usageItems.value = response.obj?.items ?? []; usage.value = response.obj ?? {} }
    else statItems.value = response.obj?.items ?? []
  }
  loading.value = false
}
const summaries = computed(() => [{ label: 'Upload', value: usage.value.upload ?? 0, color: 'text-orange' }, { label: 'Download', value: usage.value.download ?? 0, color: 'text-green' }, { label: 'Total', value: (usage.value.upload ?? 0) + (usage.value.download ?? 0), color: 'text-primary' }])
const chartData = computed(() => {
  const labels = [...new Set(statItems.value.map(item => item.dateTime))].sort().map(value => new Date(Number(value) * 1000).toLocaleString())
  const values = (direction: boolean) => [...new Set(statItems.value.map(item => item.dateTime))].sort().map(time => statItems.value.filter(item => item.dateTime === time && item.direction === direction).reduce((sum, item) => sum + Number(item.traffic || 0), 0))
  return { labels, datasets: [{ label: 'Upload', data: values(true), borderColor: '#fb8c00', backgroundColor: '#fb8c00', pointRadius: 3, tension: .15 }, { label: 'Download', data: values(false), borderColor: '#2e7d32', backgroundColor: '#2e7d32', pointRadius: 3, tension: .15 }] }
})
const chartOptions: any = { responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: 'index' }, scales: { y: { beginAtZero: true, ticks: { callback: (value: any) => bytes(value) } } } }
const bytes = (value: any) => HumanReadable.sizeFormat(Number(value || 0))
watch(tab, load)
onMounted(load)
</script>
