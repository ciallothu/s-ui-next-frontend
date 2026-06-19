<template>
  <v-alert type="info" variant="tonal" class="my-3" :text="$t('types.wg.endpointHelp')" />

  <v-card variant="outlined" class="mb-3">
    <v-card-title>{{ $t('types.wg.serverSection') }}</v-card-title>
    <v-card-text>
      <v-row>
        <v-col cols="12" md="8"><v-text-field v-model="data.private_key" :label="$t('types.wg.serverPrivateKey')" append-inner-icon="mdi-key-star" @click:append-inner="newKey" /></v-col>
        <v-col cols="12" md="8"><v-text-field v-model="publicKey" readonly :label="$t('types.wg.serverPublicKey')" append-inner-icon="mdi-refresh" @click:append-inner="getWgPubKey" /></v-col>
        <v-col cols="12" md="6"><v-text-field v-model="serverIPv4" :label="$t('types.wg.serverIpv4')" hint="/32" persistent-hint /></v-col>
        <v-col cols="12" md="6"><v-text-field v-model="serverIPv6" :label="$t('types.wg.serverIpv6')" hint="/128" persistent-hint /></v-col>
        <v-col cols="12" md="6"><v-text-field v-model="data.tunnel_ipv4_cidr" :label="$t('types.wg.tunnelIpv4')" hint="10.66.66.0/24" persistent-hint /></v-col>
        <v-col cols="12" md="6"><v-text-field v-model="data.tunnel_ipv6_cidr" :label="$t('types.wg.tunnelIpv6')" hint="fd66:66:66::/64" persistent-hint /></v-col>
        <v-col cols="12" sm="6" md="4"><v-text-field v-model.number="data.listen_port" :label="$t('types.wg.listenPort')" type="number" min="1" max="65535" /></v-col>
        <v-col cols="12" sm="6" md="4"><v-text-field v-model.number="data.mtu" label="MTU" type="number" min="576" /></v-col>
        <v-col cols="12" sm="6" md="4"><v-text-field v-model.number="udpTimeout" :label="$t('types.wg.udpTimeout')" type="number" min="0" :suffix="$t('date.m')" /></v-col>
      </v-row>
    </v-card-text>
  </v-card>

  <v-card variant="outlined" class="mb-3">
    <v-card-title>{{ $t('types.wg.clientExportSection') }}</v-card-title>
    <v-card-text>
      <v-alert type="warning" variant="tonal" class="mb-3" :text="$t('types.wg.advertisedEndpointHelp')" />
      <v-row>
        <v-col cols="12" md="8"><v-text-field v-model="data.advertised_endpoint_host" :label="$t('types.wg.advertisedHost')" /></v-col>
        <v-col cols="12" md="4"><v-text-field v-model.number="data.advertised_endpoint_port" :label="$t('types.wg.advertisedPort')" type="number" min="1" max="65535" /></v-col>
        <v-col cols="12"><v-text-field v-model="defaultClientAllowed" :label="$t('types.wg.defaultClientAllowed')" :hint="$t('commaSeparated')" persistent-hint /></v-col>
        <v-col cols="12" md="6"><v-text-field v-model="defaultClientDns" :label="$t('types.wg.defaultClientDns')" :hint="$t('commaSeparated')" persistent-hint /></v-col>
        <v-col cols="12" sm="6" md="3"><v-text-field v-model.number="data.default_client_mtu" :label="$t('types.wg.clientMtu')" type="number" min="576" /></v-col>
        <v-col cols="12" sm="6" md="3"><v-text-field v-model.number="data.default_client_keepalive" :label="$t('types.wg.clientKeepalive')" type="number" min="0" :suffix="$t('date.s')" /></v-col>
      </v-row>
    </v-card-text>
  </v-card>

  <v-card variant="outlined" class="mb-3">
    <v-card-title>{{ $t('types.wg.runtimeSection') }}</v-card-title>
    <v-card-text>
      <v-row>
        <v-col cols="12" md="6"><v-switch v-model="data.peer_to_peer_enabled" color="primary" :label="$t('types.wg.peerToPeer')" :hint="$t('types.wg.peerToPeerHelp')" persistent-hint /></v-col>
        <v-col cols="12" md="6"><v-switch v-model="data.system" color="primary" :label="$t('types.wg.sysIf')" /></v-col>
        <v-col cols="12" md="6" v-if="data.system"><v-text-field v-model="interfaceName" :label="$t('types.wg.ifName')" /></v-col>
        <v-col cols="12" v-if="data.system"><v-alert type="warning" variant="tonal" :text="$t('types.wg.systemHelp')" /></v-col>
      </v-row>
    </v-card-text>
  </v-card>

  <v-card variant="outlined" v-if="data.peers">
    <v-card-title class="d-flex align-center">
      {{ $t('types.wg.peers') }}
      <v-spacer />
      <v-btn color="primary" variant="tonal" prepend-icon="mdi-plus" @click="addPeer">{{ $t('actions.add') }}</v-btn>
    </v-card-title>
    <v-card-text>
      <v-alert v-if="data.peers.length === 0" type="info" variant="tonal" :text="$t('types.wg.noPeers')" />
      <v-card v-for="(peer, index) in data.peers" :key="peer.public_key || index" variant="tonal" class="mb-3">
        <v-card-title class="d-flex align-center">
          {{ peer.name || ($t('types.wg.peer') + ' ' + (Number(index) + 1)) }}
          <v-spacer />
          <v-btn icon="mdi-delete-outline" color="error" variant="text" @click="delPeer(Number(index))" />
        </v-card-title>
        <v-card-text><Peer :data="peer" :endpoint="data" :ext="data.ext" :index="Number(index)" @refreshPeerKey="refreshPeerKey(Number(index))" /></v-card-text>
      </v-card>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import Peer from '@/components/WgPeer.vue'

export default {
  props: ['data'],
  emits: ['newWgKey', 'getWgPubKey', 'addPeer', 'delPeer', 'refreshPeerKey'],
  created() { this.ensureDefaults() },
  methods: {
    ensureDefaults() {
      this.data.wireguard_schema = 2
      this.data.system ??= false
      this.data.peer_to_peer_enabled ??= false
      this.data.peers ??= []
      this.data.ext ??= { keys: [] }
      this.data.ext.keys ??= []
      this.data.default_client_allowed_ips ??= [this.data.tunnel_ipv4_cidr, this.data.tunnel_ipv6_cidr].filter(Boolean)
      this.data.default_client_dns ??= []
      this.data.default_client_mtu ??= this.data.mtu || 1420
      this.data.default_client_keepalive ??= 25
      this.data.advertised_endpoint_port ||= this.data.listen_port
    },
    addPeer() { this.$emit('addPeer') },
    delPeer(index: number) { this.$emit('delPeer', index) },
    refreshPeerKey(index: number) { this.$emit('refreshPeerKey', index) },
    newKey() { this.$emit('newWgKey') },
    getWgPubKey() {
      if (this.data.private_key) this.$emit('getWgPubKey', this.data.private_key)
    },
    addressFor(ipv6: boolean) {
      return (this.data.address || []).find((value: string) => ipv6 ? value.includes(':') : !value.includes(':')) || ''
    },
    setAddress(ipv6: boolean, value: string) {
      const other = (this.data.address || []).filter((item: string) => ipv6 ? !item.includes(':') : item.includes(':'))
      this.data.address = value.trim() ? [...other, value.trim()] : other
    },
  },
  computed: {
    serverIPv4: { get() { return this.addressFor(false) }, set(value: string) { this.setAddress(false, value) } },
    serverIPv6: { get() { return this.addressFor(true) }, set(value: string) { this.setAddress(true, value) } },
    publicKey: {
      get() { return this.data.ext?.public_key || '' },
      set(value: string) { this.data.ext.public_key = value },
    },
    interfaceName: {
      get() { return this.data.name || '' },
      set(value: string) { this.data.name = value.trim() || undefined },
    },
    udpTimeout: {
      get() { return this.data.udp_timeout ? parseInt(String(this.data.udp_timeout).replace('m', '')) : 5 },
      set(value: number) { this.data.udp_timeout = value > 0 ? `${value}m` : undefined },
    },
    defaultClientAllowed: {
      get() { return (this.data.default_client_allowed_ips || []).join(', ') },
      set(value: string) { this.data.default_client_allowed_ips = value.split(',').map(item => item.trim()).filter(Boolean) },
    },
    defaultClientDns: {
      get() { return (this.data.default_client_dns || []).join(', ') },
      set(value: string) { this.data.default_client_dns = value.split(',').map(item => item.trim()).filter(Boolean) },
    },
  },
  components: { Peer },
}
</script>
