<template>
  <v-card :loading="loading">
    <v-card-title class="d-flex align-center ga-2"><v-icon icon="mdi-text-box-search-outline" />Logs<v-spacer /><v-btn icon="mdi-refresh" variant="tonal" @click="load" /></v-card-title>
    <v-card-text>
      <v-row dense>
        <v-col cols="12" md="3"><v-text-field v-model="search" label="Search" prepend-inner-icon="mdi-magnify" clearable @keyup.enter="load" /></v-col>
        <v-col cols="12" md="2"><v-text-field v-model="user" label="User" clearable @keyup.enter="load" /></v-col>
        <v-col cols="12" md="2"><v-select v-model="level" label="Level" :items="levels" @update:model-value="load" /></v-col>
        <v-col cols="12" md="2"><v-text-field v-model="start" label="From" type="date" /></v-col>
        <v-col cols="12" md="2"><v-text-field v-model="end" label="To" type="date" /></v-col>
        <v-col cols="12" md="1" class="d-flex align-center"><v-btn block color="primary" @click="load">Apply</v-btn></v-col>
      </v-row>
      <v-alert v-if="!loading && items.length === 0" type="info" variant="tonal">No matching logs</v-alert>
      <v-table v-else density="compact" hover fixed-header height="calc(100vh - 260px)">
        <thead><tr><th>Time</th><th>Level</th><th>User</th><th>Source</th><th>Message</th></tr></thead>
        <tbody>
          <tr v-for="(item, index) in items" :key="`${item.timestamp}-${index}`">
            <td class="text-no-wrap">{{ item.time || formatTime(item.timestamp) }}</td>
            <td><v-chip size="small" :color="levelColor(item.level)" variant="tonal">{{ item.level }}</v-chip></td>
            <td>{{ item.user || '—' }}</td><td>{{ item.source || 'system' }}</td>
            <td class="log-message">{{ item.message }}</td>
          </tr>
        </tbody>
      </v-table>
    </v-card-text>
  </v-card>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import HttpUtils from '@/plugins/httputil'

const loading = ref(false)
const items = ref<any[]>([])
const search = ref('')
const user = ref('')
const level = ref('ALL')
const start = ref('')
const end = ref('')
const levels = ['ALL', 'DEBUG', 'INFO', 'WARNING', 'ERROR']
const unix = (value: string, endOfDay = false) => value ? Math.floor(new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}`).getTime() / 1000) : 0
const load = async () => {
  loading.value = true
  const response = await HttpUtils.get('api/structured-logs', { level: level.value, user: user.value, search: search.value, start: unix(start.value), end: unix(end.value, true), limit: 1000 })
  if (response.success) items.value = response.obj?.items ?? []
  loading.value = false
}
const levelColor = (value: string) => ({ DEBUG: 'secondary', INFO: 'info', WARNING: 'warning', ERROR: 'error' } as any)[value] ?? 'default'
const formatTime = (value: number) => value ? new Date(value * 1000).toLocaleString() : '—'
onMounted(load)
</script>

<style scoped>.log-message { white-space: pre-wrap; overflow-wrap: anywhere; font-family: monospace; }</style>
