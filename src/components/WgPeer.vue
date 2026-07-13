<template>
  <v-alert type="info" variant="tonal" class="mb-3" :text="$t('types.wg.peerHelp')" />
  <v-row>
    <v-col cols="12" md="6"><v-text-field v-model="data.name" :label="$t('types.wg.peerName')" /></v-col>
    <v-col cols="12" md="6"><v-select v-model="mode" :label="$t('types.wg.peerMode')" :items="modeItems" /></v-col>
    <v-col cols="12" md="8">
      <v-text-field :model-value="privateKeyDisplay" readonly type="password" :label="$t('types.wg.clientPrivateKey')" :hint="$t('types.wg.privateKeyExportHint')" persistent-hint>
        <template #append-inner>
          <v-btn icon="mdi-content-copy" size="small" variant="text" :disabled="!canCopyPrivateKey" :title="$t('types.wg.copySecret')" @click.stop="copySecret(privateKeyDisplay)" />
          <v-btn icon="mdi-key-star" size="small" variant="text" :title="$t(data.client_private_key || data.client_private_key_set ? 'types.wg.regenerateKeyPair' : 'types.wg.generateKeyPair')" @click.stop="refreshKey" />
        </template>
      </v-text-field>
    </v-col>
    <v-col cols="12" md="8">
      <v-text-field v-model="data.public_key" :label="$t('types.wg.clientPublicKey')">
        <template #append-inner>
          <v-btn icon="mdi-content-copy" size="small" variant="text" :disabled="!data.public_key" :title="$t('types.wg.copySecret')" @click.stop="copySecret(data.public_key)" />
          <v-btn icon="mdi-key-star" size="small" variant="text" :title="$t(data.public_key ? 'types.wg.regenerateKeyPair' : 'types.wg.generateKeyPair')" @click.stop="refreshKey" />
        </template>
      </v-text-field>
    </v-col>
    <v-col cols="12" md="8">
      <v-text-field v-model="pskValue" type="password" :label="$t('types.wg.psk')" :hint="pskIsRedacted ? $t('types.wg.secretRedacted') : ''" persistent-hint>
        <template #append-inner>
          <v-btn icon="mdi-content-copy" size="small" variant="text" :disabled="!canCopyPsk" :title="$t('types.wg.copySecret')" @click.stop="copySecret(data.pre_shared_key)" />
          <v-btn icon="mdi-shield-key-outline" size="small" variant="text" :title="$t(data.pre_shared_key || data.pre_shared_key_set ? 'types.wg.regeneratePsk' : 'types.wg.generatePsk')" @click.stop="generatePsk" />
          <v-btn icon="mdi-close-circle-outline" size="small" variant="text" :disabled="!data.pre_shared_key && !data.pre_shared_key_set" :title="$t('types.wg.clearPsk')" @click.stop="clearPsk" />
        </template>
      </v-text-field>
    </v-col>
  </v-row>

  <v-row>
    <v-col cols="12" md="6"><v-text-field v-model="assignedIPv4" :label="$t('types.wg.assignedIpv4')" hint="/32" persistent-hint /></v-col>
    <v-col cols="12" md="6"><v-text-field v-model="assignedIPv6" :label="$t('types.wg.assignedIpv6')" hint="/128" persistent-hint /></v-col>
    <v-col cols="12"><v-text-field :model-value="serverAllowed" readonly :label="$t('types.wg.serverAllowed')" :hint="$t('types.wg.serverAllowedHelp')" persistent-hint /></v-col>
  </v-row>

  <v-row v-if="mode !== 'roaming_client'">
    <v-col cols="12" md="6" v-if="data.peer_role === 'site_gateway'"><v-select v-model="data.remote_endpoint_mode" :label="$t('types.wg.remoteEndpointMode')" :items="remoteModeItems" /></v-col>
    <v-col cols="12" md="8" v-if="data.peer_role !== 'site_gateway' || data.remote_endpoint_mode === 'static'"><v-text-field v-model="data.static_remote_address" :label="$t('types.wg.staticRemoteAddress')" /></v-col>
    <v-col cols="12" md="4" v-if="data.peer_role !== 'site_gateway' || data.remote_endpoint_mode === 'static'"><v-text-field v-model.number="data.static_remote_port" :label="$t('types.wg.staticRemotePort')" type="number" min="1" max="65535" /></v-col>
    <v-col cols="12" md="4"><v-text-field v-model.number="data.persistent_keepalive_interval" :label="$t('types.wg.runtimeKeepalive')" type="number" min="0" :suffix="$t('date.s')" /></v-col>
    <v-col cols="12" v-if="data.peer_role === 'site_gateway'"><v-text-field v-model="remoteSiteCidrs" :label="$t('types.wg.remoteSiteCidrs')" :hint="$t('commaSeparated')" persistent-hint /></v-col>
    <v-col cols="12" v-if="data.peer_role === 'site_gateway'"><v-text-field v-model="localSiteCidrs" :label="$t('types.wg.localSiteCidrs')" :hint="$t('commaSeparated')" persistent-hint /></v-col>
    <v-col cols="12" v-if="data.peer_role === 'site_gateway'"><v-alert type="warning" variant="tonal" :text="$t('types.wg.siteRouteHelp')" /></v-col>
  </v-row>

  <v-divider class="my-3" />
  <v-row>
    <v-col cols="12" md="6"><v-select v-model="preset" :label="$t('types.wg.routePreset')" :items="presetItems" @update:model-value="applyPreset" /></v-col>
    <v-col cols="12" md="3"><v-switch v-model="data.include_ipv4" color="primary" :label="$t('types.wg.includeIpv4')" @update:model-value="applyPreset" /></v-col>
    <v-col cols="12" md="3"><v-switch v-model="data.include_ipv6" color="primary" :label="$t('types.wg.includeIpv6')" @update:model-value="applyPreset" /></v-col>
    <v-col cols="12"><v-text-field v-model="clientAllowed" :label="$t('types.wg.clientAllowed')" :hint="$t('types.wg.clientAllowedHelp')" persistent-hint :readonly="preset !== 'custom' && preset !== 'single_peer'" /></v-col>
    <v-col cols="12" md="6"><v-text-field v-model="clientDns" :label="$t('types.wg.clientDns')" :hint="$t('commaSeparated')" persistent-hint /></v-col>
    <v-col cols="12" sm="6" md="3"><v-text-field v-model.number="data.client_mtu" :label="$t('types.wg.clientMtu')" type="number" min="576" /></v-col>
    <v-col cols="12" sm="6" md="3"><v-text-field v-model.number="data.client_keepalive" :label="$t('types.wg.clientKeepalive')" type="number" min="0" :suffix="$t('date.s')" /></v-col>
  </v-row>
</template>

<script lang="ts">
import HttpUtils from '@/plugins/httputil'

const redactedSecret = '[redacted]'

export default {
  props: ['data', 'endpoint', 'ext', 'index'],
  emits: ['refreshPeerKey'],
  created() { this.ensureDefaults() },
  methods: {
    ensureDefaults() {
      this.data.peer_mode ||= 'roaming_client'
      this.data.peer_role ||= this.data.peer_mode === 'static_peer' ? 'fixed_node' : this.data.peer_mode === 'site_to_site' ? 'site_gateway' : 'client'
      this.data.remote_endpoint_mode ||= this.data.peer_role === 'client' ? 'dynamic' : this.data.static_remote_address ? 'static' : this.data.peer_role === 'site_gateway' ? 'dynamic' : 'static'
      this.data.client_route_preset ||= 'virtual_network'
      this.data.include_ipv4 ??= Boolean(this.endpoint.tunnel_ipv4_cidr)
      this.data.include_ipv6 ??= Boolean(this.endpoint.tunnel_ipv6_cidr)
      this.data.client_mtu ??= this.endpoint.default_client_mtu || this.endpoint.mtu || 1420
      this.data.client_keepalive ??= this.endpoint.default_client_keepalive || 25
      this.data.client_dns ??= [...(this.endpoint.default_client_dns || [])]
      this.syncServerAllowed()
      if (!this.data.client_allowed_ips?.length) this.applyPreset()
    },
    refreshKey() { this.$emit('refreshPeerKey') },
    secretVisible(value: string) { return Boolean(value) && value !== redactedSecret && !String(value).includes('•') },
    async copySecret(value: string) {
      if (!this.secretVisible(value)) return
      await navigator.clipboard.writeText(value)
    },
    parseKeypair(lines: string[]) {
      const result = { private_key: '', public_key: '', pre_shared_key: '' }
      lines.forEach((line: string) => {
        if (line.startsWith('PrivateKey:')) result.private_key = line.substring(11).trim()
        if (line.startsWith('PublicKey:')) result.public_key = line.substring(10).trim()
        if (line.startsWith('PresharedKey:')) result.pre_shared_key = line.substring(13).trim()
      })
      return result
    },
    async generatePsk() {
      const msg = await HttpUtils.get('api/keypairs', { k: 'wireguard-psk' })
      if (!msg.success) return
      const parsed = this.parseKeypair(msg.obj || [])
      if (!parsed.pre_shared_key) return
      this.data.pre_shared_key = parsed.pre_shared_key
      this.data.pre_shared_key_set = true
      delete this.data.pre_shared_key_clear
    },
    clearPsk() {
      this.data.pre_shared_key = ''
      this.data.pre_shared_key_set = false
      this.data.pre_shared_key_clear = true
    },
    syncServerAllowed() {
      const values = [this.data.assigned_ipv4, this.data.assigned_ipv6].filter(Boolean)
      if (values.length) {
        this.data.server_allowed_ips = values
        this.data.allowed_ips = values
      }
    },
    applyPreset() {
      const include4 = this.data.include_ipv4 !== false
      const include6 = this.data.include_ipv6 !== false
      let values: string[]
      switch (this.data.client_route_preset) {
        case 'full_tunnel': values = ['0.0.0.0/0', '::/0']; break
        case 'single_peer': {
          const target = (this.endpoint.peers || []).find((peer: any) => peer !== this.data)
          values = target ? [target.assigned_ipv4, target.assigned_ipv6].filter(Boolean) : []
          break
        }
        case 'custom': return
        default: values = [this.endpoint.tunnel_ipv4_cidr, this.endpoint.tunnel_ipv6_cidr].filter(Boolean)
      }
      this.data.client_allowed_ips = values.filter(value => value.includes(':') ? include6 : include4)
    },
  },
  computed: {
    modeItems() {
      return [
        { title: this.$t('types.wg.roamingClient'), value: 'roaming_client' },
        { title: this.$t('types.wg.staticPeer'), value: 'static_peer' },
        { title: this.$t('types.wg.siteToSite'), value: 'site_to_site' },
      ]
    },
    presetItems() {
      return [
        { title: this.$t('types.wg.virtualNetworkPreset'), value: 'virtual_network' },
        { title: this.$t('types.wg.singlePeerPreset'), value: 'single_peer' },
        { title: this.$t('types.wg.customPreset'), value: 'custom' },
        { title: this.$t('types.wg.fullTunnelPreset'), value: 'full_tunnel' },
      ]
    },
    remoteModeItems() {
      return [
        { title: this.$t('types.wg.dynamicEndpoint'), value: 'dynamic' },
        { title: this.$t('types.wg.staticEndpoint'), value: 'static' },
      ]
    },
    mode: {
      get() { return this.data.peer_mode || 'roaming_client' },
      set(value: string) {
        this.data.peer_mode = value
        this.data.peer_role = value === 'static_peer' ? 'fixed_node' : value === 'site_to_site' ? 'site_gateway' : 'client'
        this.data.remote_endpoint_mode = this.data.peer_role === 'client' ? 'dynamic' : this.data.remote_endpoint_mode || 'static'
        if (value === 'roaming_client') {
          this.data.static_remote_address = undefined
          this.data.static_remote_port = undefined
          this.data.address = undefined
          this.data.port = undefined
        }
      },
    },
    preset: {
      get() { return this.data.client_route_preset || 'virtual_network' },
      set(value: string) { this.data.client_route_preset = value },
    },
    assignedIPv4: {
      get() { return this.data.assigned_ipv4 || (this.data.allowed_ips || []).find((value: string) => !value.includes(':')) || '' },
      set(value: string) { this.data.assigned_ipv4 = value.trim() || undefined; this.syncServerAllowed() },
    },
    assignedIPv6: {
      get() { return this.data.assigned_ipv6 || (this.data.allowed_ips || []).find((value: string) => value.includes(':')) || '' },
      set(value: string) { this.data.assigned_ipv6 = value.trim() || undefined; this.syncServerAllowed() },
    },
    serverAllowed() { return (this.data.server_allowed_ips || this.data.allowed_ips || []).join(', ') },
    clientAllowed: {
      get() { return (this.data.client_allowed_ips || []).join(', ') },
      set(value: string) { this.data.client_allowed_ips = value.split(',').map(item => item.trim()).filter(Boolean) },
    },
    clientDns: {
      get() { return (this.data.client_dns || []).join(', ') },
      set(value: string) { this.data.client_dns = value.split(',').map(item => item.trim()).filter(Boolean) },
    },
    remoteSiteCidrs: {
      get() { return (this.data.remote_site_cidrs || []).join(', ') },
      set(value: string) { this.data.remote_site_cidrs = value.split(',').map(item => item.trim()).filter(Boolean) },
    },
    localSiteCidrs: {
      get() { return (this.data.local_site_cidrs || []).join(', ') },
      set(value: string) { this.data.local_site_cidrs = value.split(',').map(item => item.trim()).filter(Boolean) },
    },
    privateKeyDisplay() {
      if (this.data.client_private_key) return this.data.client_private_key
      if (this.data.client_private_key_set) return '••••••••••••••••'
      const legacy = this.ext?.keys?.find((key: any) => key.public_key === this.data.public_key)
      return legacy?.private_key || ''
    },
    pskIsRedacted() { return this.data.pre_shared_key === redactedSecret || String(this.data.pre_shared_key || '').includes('•') },
    pskValue: {
      get() {
        if (this.data.pre_shared_key) return this.data.pre_shared_key
        return this.data.pre_shared_key_set ? '••••••••••••••••' : ''
      },
      set(value: string) {
        this.data.pre_shared_key = value
        this.data.pre_shared_key_set = Boolean(value)
        delete this.data.pre_shared_key_clear
      },
    },
    canCopyPrivateKey() { return this.secretVisible(this.privateKeyDisplay) },
    canCopyPsk() { return this.secretVisible(this.data.pre_shared_key) },
  },
}
</script>
