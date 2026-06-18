<template>
  <v-row>
    <v-col v-for="group in groups" :key="group.title" cols="12" md="6">
      <v-card height="100%"><v-card-title>{{ group.title }}</v-card-title><v-list>
        <v-list-item v-for="item in group.items" :key="item.title" :prepend-icon="item.icon" :title="item.title" :subtitle="item.subtitle" @click="item.action"><template #append><v-icon icon="mdi-chevron-right" /></template></v-list-item>
      </v-list></v-card>
    </v-col>
  </v-row>
	<input ref="databaseInput" type="file" accept=".db,application/x-sqlite3" hidden @change="restoreDatabase" />
	<v-dialog v-model="resultVisible" max-width="720"><v-card :title="resultTitle"><v-card-text><pre class="tool-result">{{ resultText }}</pre></v-card-text><v-card-actions><v-spacer /><v-btn color="primary" @click="resultVisible = false">Close</v-btn></v-card-actions></v-card></v-dialog>
</template>
<script lang="ts" setup>
import { ref } from 'vue'
import HttpUtils from '@/plugins/httputil'
const resultVisible = ref(false), resultTitle = ref('Result'), resultText = ref('')
const databaseInput = ref<HTMLInputElement | null>(null)
const download = (path: string) => window.open(path, '_blank', 'noopener')
const restart = async (target: 'restartSb' | 'restartApp') => { if (window.confirm('The service will be briefly unavailable. Continue?')) await HttpUtils.post(`api/${target}`, {}) }
const showResult = (title: string, value: any) => { resultTitle.value = title; resultText.value = typeof value === 'string' ? value : JSON.stringify(value, null, 2); resultVisible.value = true }
const promptTool = async (endpoint: string, label: string) => { const value = window.prompt(label); if (!value) return; const response = await HttpUtils.post(`api/${endpoint}`, { link: value }); if (response.success) showResult(label, response.obj) }
const keypair = async () => { const type = window.prompt('Key type: reality, wireguard, tls or ech', 'reality'); if (!type) return; const options = window.prompt('Options / server name (optional)', '') ?? ''; const response = await HttpUtils.get('api/keypairs', { k: type, o: options }); if (response.success) showResult(`${type} key pair`, response.obj) }
const restoreDatabase = async (event: Event) => { const input = event.target as HTMLInputElement; const file = input.files?.[0]; if (!file || !window.confirm('Restore this database and replace the current panel data?')) { input.value = ''; return }; const form = new FormData(); form.append('db', file); await HttpUtils.post('api/importdb', form); input.value = '' }
const groups = [
  { title: 'Backup & restore', items: [
    { title: 'Download database', subtitle: 'Full panel backup', icon: 'mdi-database-export-outline', action: () => download('api/getdb') },
	{ title: 'Restore database', subtitle: 'Replace panel data from a backup', icon: 'mdi-database-import-outline', action: () => databaseInput.value?.click() },
    { title: 'Download sing-box config', subtitle: 'Generated runtime JSON', icon: 'mdi-code-json', action: () => download('api/singbox-config') },
  ]},
  { title: 'Conversion & keys', items: [
    { title: 'Share link converter', subtitle: 'Convert a proxy link to an outbound', icon: 'mdi-swap-horizontal', action: () => promptTool('linkConvert', 'Share link') },
    { title: 'Subscription converter', subtitle: 'Import an external subscription', icon: 'mdi-playlist-plus', action: () => promptTool('subConvert', 'Subscription URL') },
	{ title: 'Generate key pairs', subtitle: 'Reality, WireGuard, TLS and ECH', icon: 'mdi-key-star', action: keypair },
  ]},
  { title: 'Service actions', items: [
    { title: 'Restart sing-box', subtitle: 'Reload core configuration', icon: 'mdi-restart', action: () => restart('restartSb') },
    { title: 'Restart S-UI', subtitle: 'Restart the panel process', icon: 'mdi-power', action: () => restart('restartApp') },
  ]},
]
</script>
<style scoped>.tool-result { white-space: pre-wrap; overflow-wrap: anywhere; user-select: all; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }</style>
