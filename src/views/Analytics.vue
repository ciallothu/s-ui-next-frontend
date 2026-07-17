<template>
  <v-card :loading="loading">
    <v-tabs v-model="tab" align-tabs="center" show-arrows>
      <v-tab value="usage">{{ $t('analytics.userUsage') }}</v-tab>
      <v-tab value="stats">{{ $t('analytics.trafficTrends') }}</v-tab>
      <v-tab value="connections">{{ $t('analytics.connections') }}</v-tab>
      <v-tab value="logs">{{ $t('logsView.title') }}</v-tab>
    </v-tabs>
    <v-card-text>
      <v-row density="compact">
        <v-col cols="12" md="3"><v-text-field v-model="search" :label="$t('analytics.search')" prepend-inner-icon="mdi-magnify" clearable @keyup.enter="load" /></v-col>
        <v-col cols="12" md="2"><v-text-field v-model="tag" :label="tagLabel" clearable @keyup.enter="load" /></v-col>
        <v-col v-if="tab === 'stats' || tab === 'connections'" cols="12" md="2"><v-select v-model="resource" :label="$t('analytics.resource')" :items="resources" /></v-col>
        <v-col v-if="tab === 'logs'" cols="12" md="2"><v-select v-model="logLevel" :label="$t('logsView.level')" :items="levels" @update:model-value="load" /></v-col>
        <v-col cols="12" md="2"><v-text-field v-model="start" :label="$t('analytics.from')" type="date" /></v-col>
        <v-col cols="12" md="2"><v-text-field v-model="end" :label="$t('analytics.to')" type="date" /></v-col>
        <v-col cols="12" md="1" class="d-flex align-center"><v-btn block color="primary" @click="load">{{ $t('analytics.apply') }}</v-btn></v-col>
      </v-row>
      <v-window v-model="tab">
        <v-window-item value="usage">
          <v-row class="my-1">
            <v-col v-for="summary in summaries" :key="summary.label" cols="12" sm="4">
              <v-card variant="tonal"><v-card-text><div class="text-medium-emphasis">{{ summary.label }}</div><div class="text-h6" :class="summary.color">{{ bytes(summary.value) }}</div></v-card-text></v-card>
            </v-col>
          </v-row>
          <v-table density="comfortable" hover>
            <thead><tr><th>{{ $t('analytics.user') }}</th><th>{{ $t('analytics.group') }}</th><th>{{ $t('analytics.upload') }}</th><th>{{ $t('analytics.download') }}</th><th>{{ $t('analytics.total') }}</th><th>{{ $t('analytics.quota') }}</th><th>{{ $t('analytics.online') }}</th><th>{{ $t('actions.action') }}</th></tr></thead>
            <tbody>
              <tr v-for="item in usageItems" :key="item.user">
                <td>{{ item.user }}</td><td>{{ item.group || '—' }}</td><td class="text-orange">{{ bytes(item.upload) }}</td><td class="text-green">{{ bytes(item.download) }}</td><td>{{ bytes(item.total) }}</td><td>{{ bytes(item.quota) }}</td><td><v-icon :color="item.online ? 'success' : 'disabled'" icon="mdi-circle" size="small" /></td>
                <td><v-btn size="small" variant="text" prepend-icon="mdi-text-search" @click="openConnections('user', item.user)">{{ $t('analytics.details') }}</v-btn></td>
              </tr>
            </tbody>
          </v-table>
        </v-window-item>
        <v-window-item value="stats">
          <v-card variant="outlined" class="mt-4"><v-card-text style="height: 420px"><Line v-if="chartData.labels.length" :data="chartData" :options="chartOptions" /><v-alert v-else type="info" variant="tonal">{{ $t('analytics.noTraffic') }}</v-alert></v-card-text></v-card>
        </v-window-item>
        <v-window-item value="connections">
          <v-alert type="info" variant="tonal" class="my-3">{{ $t('analytics.scannedLogs', { count: connectionData.scanned ?? 0 }) }}</v-alert>
          <v-row density="compact">
            <v-col v-for="group in connectionGroups" :key="group.key" cols="12" md="6">
              <v-card variant="outlined" height="100%">
                <v-card-title>{{ group.title }}</v-card-title>
                <v-table density="compact" hover>
                  <thead><tr><th>{{ $t('analytics.tag') }}</th><th>{{ $t('analytics.count') }}</th><th>{{ $t('analytics.lastSeen') }}</th><th>{{ $t('actions.action') }}</th></tr></thead>
                  <tbody>
                    <tr v-for="item in group.items" :key="`${group.key}-${item.tag}`">
                      <td>{{ item.tag }}</td><td>{{ item.count }}</td><td>{{ formatTime(item.lastSeen) }}</td>
                      <td><v-btn size="small" variant="text" @click="openConnections(item.resource || group.resource, item.tag)">{{ $t('analytics.details') }}</v-btn></td>
                    </tr>
                    <tr v-if="!group.items.length"><td colspan="4" class="text-medium-emphasis">{{ $t('analytics.noConnections') }}</td></tr>
                  </tbody>
                </v-table>
              </v-card>
            </v-col>
          </v-row>
          <v-table density="compact" hover class="mt-4">
            <thead><tr><th>{{ $t('logsView.time') }}</th><th>{{ $t('analytics.resource') }}</th><th>{{ $t('analytics.user') }}</th><th>{{ $t('analytics.destination') }}</th><th>{{ $t('analytics.event') }}</th></tr></thead>
            <tbody>
              <tr v-for="(item, index) in connectionItems" :key="`${item.timestamp}-${index}`">
                <td>{{ item.time || formatTime(item.timestamp) }}</td><td>{{ item.resource }}/{{ item.protocol }}[{{ item.tag }}]</td><td>{{ item.user || '—' }}</td>
                <td>
                  <div>{{ item.destination || item.source || '—' }}</div>
                  <div v-if="connectionMeta(item)" class="text-caption text-medium-emphasis">{{ connectionMeta(item) }}</div>
                </td>
                <td><v-btn size="small" variant="text" @click="openConnectionLog(item)">{{ $t('analytics.viewLog') }}</v-btn></td>
              </tr>
            </tbody>
          </v-table>
        </v-window-item>
        <v-window-item value="logs">
          <v-alert type="info" variant="tonal" class="my-3">{{ $t('logsView.subtitle') }}</v-alert>
          <v-alert v-if="!loading && logItems.length === 0" type="info" variant="tonal">{{ $t('logsView.noLogs') }}</v-alert>
          <v-table v-else density="compact" hover fixed-header height="calc(100vh - 330px)">
            <thead><tr><th>{{ $t('logsView.time') }}</th><th>{{ $t('logsView.level') }}</th><th>{{ $t('logsView.user') }}</th><th>{{ $t('logsView.source') }}</th><th>{{ $t('logsView.message') }}</th></tr></thead>
            <tbody>
              <tr v-for="(item, index) in logItems" :key="`${item.timestamp}-${index}`">
                <td class="text-no-wrap">{{ item.time || formatTime(item.timestamp) }}</td>
                <td><v-chip size="small" :color="levelColor(item.level)" variant="tonal">{{ item.level }}</v-chip></td>
                <td>{{ item.user || '—' }}</td><td>{{ item.source || 'system' }}</td>
                <td class="log-message">
                  <div>{{ item.message }}</div>
                  <div v-if="connectionMeta(item.connection)" class="text-caption text-medium-emphasis">{{ connectionMeta(item.connection) }}</div>
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-window-item>
      </v-window>
    </v-card-text>
  </v-card>

  <v-dialog v-model="detailVisible" width="calc(100% - 32px)" max-width="1200">
    <v-card :title="detailTitle">
      <v-card-text>
        <v-progress-linear v-if="detailLoading" indeterminate color="primary" />
        <v-alert v-else-if="detailItems.length === 0" type="info" variant="tonal">{{ $t('analytics.noConnections') }}</v-alert>
        <div v-else class="connection-detail-scroll">
          <v-table density="compact" hover class="connection-detail-table">
            <colgroup>
              <col class="connection-col-time">
              <col class="connection-col-resource">
              <col class="connection-col-user">
              <col class="connection-col-endpoint">
              <col class="connection-col-endpoint">
              <col class="connection-col-message">
            </colgroup>
            <thead><tr><th>{{ $t('logsView.time') }}</th><th>{{ $t('analytics.resource') }}</th><th>{{ $t('analytics.user') }}</th><th>{{ $t('analytics.destination') }}</th><th>{{ $t('analytics.source') }}</th><th>{{ $t('analytics.message') }}</th></tr></thead>
            <tbody>
              <tr v-for="(item, index) in detailItems" :key="`${item.timestamp}-${index}`" @click="openConnectionLog(item)" class="cursor-pointer">
                <td class="text-no-wrap">{{ item.time || formatTime(item.timestamp) }}</td>
                <td class="connection-break">{{ item.resource }}/{{ item.protocol }}[{{ item.tag }}]</td>
                <td class="connection-break">{{ item.user || '—' }}</td>
                <td class="connection-break">
                  <div>{{ item.destination || '—' }}</div>
                  <div v-if="endpointMeta(item.destinationInfo)" class="text-caption text-medium-emphasis">{{ endpointMeta(item.destinationInfo) }}</div>
                </td>
                <td class="connection-break">
                  <div>{{ item.source || '—' }}</div>
                  <div v-if="endpointMeta(item.sourceInfo)" class="text-caption text-medium-emphasis">{{ endpointMeta(item.sourceInfo) }}</div>
                </td>
                <td><div class="connection-message">{{ item.message }}</div></td>
              </tr>
            </tbody>
          </v-table>
          <div class="connection-detail-cards">
            <div
              v-for="(item, index) in detailItems"
              :key="`mobile-${item.timestamp}-${index}`"
              class="connection-detail-card cursor-pointer"
              role="button"
              tabindex="0"
              @click="openConnectionLog(item)"
              @keydown.enter="openConnectionLog(item)"
              @keydown.space.prevent="openConnectionLog(item)"
            >
              <div class="connection-detail-card-grid">
                <strong>{{ $t('logsView.time') }}</strong><span>{{ item.time || formatTime(item.timestamp) }}</span>
                <strong>{{ $t('analytics.resource') }}</strong><span class="connection-break">{{ item.resource }}/{{ item.protocol }}[{{ item.tag }}]</span>
                <strong>{{ $t('analytics.user') }}</strong><span class="connection-break">{{ item.user || '—' }}</span>
                <strong>{{ $t('analytics.destination') }}</strong>
                <span class="connection-break">
                  {{ item.destination || '—' }}
                  <small v-if="endpointMeta(item.destinationInfo)" class="d-block text-medium-emphasis">{{ endpointMeta(item.destinationInfo) }}</small>
                </span>
                <strong>{{ $t('analytics.source') }}</strong>
                <span class="connection-break">
                  {{ item.source || '—' }}
                  <small v-if="endpointMeta(item.sourceInfo)" class="d-block text-medium-emphasis">{{ endpointMeta(item.sourceInfo) }}</small>
                </span>
              </div>
              <div class="connection-message mt-3">{{ item.message }}</div>
            </div>
          </div>
        </div>
      </v-card-text>
      <v-card-actions><v-spacer /><v-btn color="primary" @click="detailVisible = false">{{ $t('actions.close') }}</v-btn></v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="connectionLogVisible" max-width="880">
    <v-card :title="$t('analytics.connectionLog')">
      <v-progress-linear v-if="connectionLogResolving" indeterminate />
      <v-card-text v-if="selectedConnection">
        <v-row density="compact">
          <v-col cols="12" md="6"><strong>{{ $t('logsView.time') }}:</strong> {{ selectedConnection.time || formatTime(selectedConnection.timestamp) }}</v-col>
          <v-col cols="12" md="6"><strong>{{ $t('analytics.resource') }}:</strong> {{ selectedConnection.resource }}/{{ selectedConnection.protocol }}[{{ selectedConnection.tag }}]</v-col>
          <v-col cols="12" md="6"><strong>{{ $t('analytics.user') }}:</strong> {{ selectedConnection.user || '—' }}</v-col>
          <v-col cols="12" md="6"><strong>{{ $t('analytics.destination') }}:</strong> {{ selectedConnection.destination || '—' }}</v-col>
          <v-col cols="12" md="6"><strong>{{ $t('analytics.source') }}:</strong> {{ selectedConnection.source || '—' }}</v-col>
        </v-row>
        <v-row v-for="section in endpointSections(selectedConnection)" :key="section.title" density="compact" class="mt-3">
          <v-col cols="12" class="text-subtitle-2">{{ section.title }}</v-col>
          <v-col v-for="field in section.fields" :key="field.label" cols="12" md="6"><strong>{{ field.label }}:</strong> {{ field.value }}</v-col>
        </v-row>
        <v-divider class="my-4" />
        <div class="text-medium-emphasis mb-2">{{ $t('logsView.message') }}</div>
        <pre class="log-message">{{ selectedConnection.message }}</pre>
      </v-card-text>
      <v-card-actions><v-spacer /><v-btn color="primary" @click="connectionLogVisible = false">{{ $t('actions.close') }}</v-btn></v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Line } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js'
import HttpUtils from '@/plugins/httputil'
import { HumanReadable } from '@/plugins/utils'
import { i18n } from '@/locales'
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

const t = (key: string, params?: any) => i18n.global.t(key, params)
const tab = ref('usage'), loading = ref(false), search = ref(''), tag = ref(''), resource = ref('all'), logLevel = ref('ALL')
const start = ref(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)), end = ref(new Date().toISOString().slice(0, 10))
const usageItems = ref<any[]>([]), statItems = ref<any[]>([]), usage = ref<any>({ upload: 0, download: 0 })
const connectionData = ref<any>({ items: [], summary: {}, scanned: 0 })
const logItems = ref<any[]>([])
const detailVisible = ref(false), detailTitle = ref(''), detailItems = ref<any[]>([])
const detailLoading = ref(false)
const connectionLogVisible = ref(false), connectionLogResolving = ref(false), selectedConnection = ref<any>(null)
let connectionLogRequest = 0
const levels = ['ALL', 'DEBUG', 'INFO', 'WARNING', 'ERROR']
const resources = computed(() => [
  { title: t('analytics.users'), value: 'user' },
  { title: t('analytics.inbounds'), value: 'inbound' },
  { title: t('analytics.outbounds'), value: 'outbound' },
  { title: t('analytics.nodes'), value: 'endpoint' },
  { title: t('analytics.destinations'), value: 'destination' },
  { title: t('all'), value: 'all' },
])
const tagLabel = computed(() => tab.value === 'usage' || tab.value === 'logs' ? t('analytics.user') : t('analytics.tag'))
const unix = (value: string, last = false) => Math.floor(new Date(`${value}T${last ? '23:59:59' : '00:00:00'}`).getTime() / 1000)
const query = (limit = 2000) => ({ search: search.value, start: unix(start.value), end: unix(end.value, true), limit })
const load = async () => {
  loading.value = true
  try {
    if (tab.value === 'usage') {
      const response = await HttpUtils.get('api/analytics-usage', { ...query(2000), user: tag.value })
      usageItems.value = response.success ? response.obj?.items ?? [] : []
      usage.value = response.success ? response.obj ?? {} : { upload: 0, download: 0 }
    } else if (tab.value === 'stats') {
      const response = await HttpUtils.get('api/analytics-stats', { ...query(2000), tag: tag.value, resource: resource.value })
      statItems.value = response.success ? response.obj?.items ?? [] : []
    } else if (tab.value === 'connections') {
      const response = await HttpUtils.get('api/analytics-connections', { ...query(500), tag: tag.value, resource: resource.value })
      connectionData.value = response.success ? response.obj ?? { items: [], summary: {}, scanned: 0 } : { items: [], summary: {}, scanned: 0 }
    } else {
      const response = await HttpUtils.get('api/structured-logs', { level: logLevel.value, user: tag.value, search: search.value, start: unix(start.value), end: unix(end.value, true), limit: 1000 })
      logItems.value = response.success ? response.obj?.items ?? [] : []
    }
  } finally {
    loading.value = false
  }
}
const summaries = computed(() => [{ label: t('analytics.upload'), value: usage.value.upload ?? 0, color: 'text-orange' }, { label: t('analytics.download'), value: usage.value.download ?? 0, color: 'text-green' }, { label: t('analytics.total'), value: (usage.value.upload ?? 0) + (usage.value.download ?? 0), color: 'text-primary' }])
const chartData = computed(() => {
  const times = [...new Set(statItems.value.map(item => item.dateTime))].sort()
  const labels = times.map(value => new Date(Number(value) * 1000).toLocaleString())
  const values = (direction: boolean) => times.map(time => statItems.value.filter(item => item.dateTime === time && item.direction === direction).reduce((sum, item) => sum + Number(item.traffic || 0), 0))
  return { labels, datasets: [{ label: t('analytics.upload'), data: values(true), borderColor: '#fb8c00', backgroundColor: '#fb8c00', pointRadius: 3, tension: .15 }, { label: t('analytics.download'), data: values(false), borderColor: '#2e7d32', backgroundColor: '#2e7d32', pointRadius: 3, tension: .15 }] }
})
const connectionItems = computed(() => connectionData.value?.items ?? [])
const connectionGroups = computed(() => {
  const summary = connectionData.value?.summary ?? {}
  return [
    { key: 'users', resource: 'user', title: t('analytics.users'), items: summary.users ?? [] },
    { key: 'inbounds', resource: 'inbound', title: t('analytics.inbounds'), items: summary.inbounds ?? [] },
    { key: 'outbounds', resource: 'outbound', title: t('analytics.outbounds'), items: summary.outbounds ?? [] },
    { key: 'endpoints', resource: 'endpoint', title: t('analytics.nodes'), items: summary.endpoints ?? [] },
    { key: 'destinations', resource: 'destination', title: t('analytics.destinations'), items: summary.destinations ?? [] },
  ]
})
const chartOptions: any = { responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: 'index' }, scales: { y: { beginAtZero: true, ticks: { callback: (value: any) => bytes(value) } } } }
const bytes = (value: any) => HumanReadable.sizeFormat(Number(value || 0))
const formatTime = (value: number) => value ? new Date(value * 1000).toLocaleString() : '—'
const levelColor = (value: string) => ({ DEBUG: 'secondary', INFO: 'info', WARNING: 'warning', ERROR: 'error' } as any)[value] ?? 'default'
const endpointTarget = (info: any) => info?.host || info?.ip || info?.address || ''
const endpointOwnership = (info: any) => {
  if (!info) return ''
  const parts: string[] = []
  const add = (value: any) => {
    const text = String(value || '').trim()
    if (text && !parts.some(item => item.toLocaleLowerCase() === text.toLocaleLowerCase())) parts.push(text)
  }
  if (info.isp) add(info.isp)
  else if (info.scope !== 'domain') add(info.attribution)
  add(info.city || info.region || info.country)
  if (info.ip && info.ip !== endpointTarget(info)) add(info.ip)
  if (!parts.length && info.scope !== 'domain') add(scopeLabel(info.scope))
  return parts.join(' · ')
}
const endpointMeta = (info: any) => {
  if (!info) return ''
  const parts = [endpointTarget(info), endpointOwnership(info)].filter(Boolean)
  return parts.join(' · ')
}
const connectionMeta = (item: any) => item ? (endpointMeta(item.destinationInfo) || endpointMeta(item.sourceInfo)) : ''
const scopeLabel = (scope: string) => {
  const key = ({
    private: 'analytics.scopePrivate',
    loopback: 'analytics.scopeLoopback',
    link_local: 'analytics.scopeLinkLocal',
    multicast: 'analytics.scopeMulticast',
    reserved: 'analytics.scopeReserved',
    unspecified: 'analytics.scopeReserved',
    public: 'analytics.scopePublic',
    domain: 'analytics.scopeDomain',
  } as any)[scope] ?? 'analytics.scopeUnknown'
  return t(key)
}
const sameEndpoint = (left: any, right: any) => left && right && left.address === right.address && left.ip === right.ip && left.host === right.host
const endpointSections = (item: any) => {
  if (!item) return []
  const endpoints = [
    { title: t('analytics.source'), info: item.sourceInfo },
    { title: t('analytics.destination'), info: item.destinationInfo },
  ].filter((entry, index, source) => entry.info && source.findIndex(other => sameEndpoint(entry.info, other.info)) === index)
  return endpoints.map(entry => ({
    title: entry.title,
    fields: [
      { label: t('analytics.ipAddress'), value: endpointTarget(entry.info) },
      { label: t('analytics.ipAttribution'), value: endpointOwnership(entry.info) },
    ].filter(field => field.value),
  })).filter(entry => entry.fields.length)
}
const openConnections = async (nextResource: string, nextTag: string) => {
  detailTitle.value = `${t('analytics.connectionDetails')} · ${nextResource}/${nextTag}`
  detailVisible.value = true
  detailItems.value = []
  detailLoading.value = true
  try {
    const response = await HttpUtils.get('api/analytics-connections', { ...query(500), resource: nextResource, tag: nextTag })
    detailItems.value = response.success ? response.obj?.items ?? [] : []
  } finally {
    detailLoading.value = false
  }
}
const openConnectionLog = async (item: any) => {
  const requestId = ++connectionLogRequest
  selectedConnection.value = { ...item }
  connectionLogVisible.value = true
  connectionLogResolving.value = false
  const address = item.destination || item.source
  const infoKey = item.destination ? 'destinationInfo' : item.source ? 'sourceInfo' : ''
  const currentInfo = infoKey ? item[infoKey] : null
  const hasLocation = currentInfo?.city || currentInfo?.region || currentInfo?.country
  const needsPublicLookup = currentInfo && ['domain', 'public'].includes(currentInfo.scope)
  const complete = Boolean(currentInfo && (!needsPublicLookup || (currentInfo.ip && currentInfo.isp && hasLocation)))
  if (!address || !infoKey || complete) return
  connectionLogResolving.value = true
  try {
    const response = await HttpUtils.get('api/analytics-address-info', { address })
    if (requestId !== connectionLogRequest || !response.success || !selectedConnection.value) return
    const next = { ...selectedConnection.value, [infoKey]: response.obj }
    if (infoKey === 'destinationInfo' && next.remote === next.destination) next.remoteInfo = response.obj
    selectedConnection.value = next
  } catch {
    // Leave the original connection details visible when lookup is unavailable.
  } finally {
    if (requestId === connectionLogRequest) connectionLogResolving.value = false
  }
}
watch(tab, () => { if (tab.value === 'usage') resource.value = 'all'; load() })
onMounted(load)
</script>

<style scoped>
.log-message { white-space: pre-wrap; overflow-wrap: anywhere; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.cursor-pointer { cursor: pointer; }
.connection-detail-scroll { max-height: min(65vh, 560px); overflow: auto; }
.connection-detail-table :deep(table) { min-width: 1040px; table-layout: fixed; }
.connection-detail-table :deep(th) { position: sticky; top: 0; z-index: 1; background: rgb(var(--v-theme-surface)); }
.connection-detail-table :deep(td) { height: auto; vertical-align: top; padding-block: 10px; }
.connection-detail-cards { display: none; }
.connection-detail-card { padding: 14px; border: thin solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 4px; }
.connection-detail-card + .connection-detail-card { margin-top: 10px; }
.connection-detail-card-grid { display: grid; grid-template-columns: minmax(88px, auto) minmax(0, 1fr); gap: 8px 12px; }
.connection-col-time { width: 92px; }
.connection-col-resource { width: 190px; }
.connection-col-user { width: 100px; }
.connection-col-endpoint { width: 190px; }
.connection-col-message { width: 278px; }
.connection-break { overflow-wrap: anywhere; word-break: break-word; }
.connection-message {
  display: -webkit-box;
  overflow: hidden;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
}
@media (max-width: 700px) {
  .connection-detail-table { display: none; }
  .connection-detail-cards { display: block; }
  .connection-detail-scroll { max-height: 65vh; }
}
</style>
