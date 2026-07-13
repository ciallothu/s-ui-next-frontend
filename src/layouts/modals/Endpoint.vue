<template>
  <v-dialog transition="dialog-bottom-transition" width="800">
    <v-card class="rounded-lg">
      <v-card-title>
        {{ $t('actions.' + title) + " " + $t('objects.endpoint') }}
      </v-card-title>
      <v-divider></v-divider>
      <v-card-text style="padding: 0 16px; overflow-y: scroll;">
		<div class="d-flex justify-end pt-2"><JsonObjectEditor v-model="endpoint" /></div>
        <v-row>
          <v-col cols="12" sm="6" md="4">
            <v-select
            hide-details
            :disabled="endpoint.id > 0"
            :label="$t('type')"
            :items="Object.keys(epTypes).map((key,index) => ({title: key, value: Object.values(epTypes)[index]}))"
            v-model="endpoint.type"
            @update:modelValue="changeType">
            </v-select>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="endpoint.tag" :label="$t('objects.tag')" hide-details></v-text-field>
          </v-col>
        </v-row>
        <Wireguard v-if="endpoint.type == epTypes.Wireguard"
          :data="endpoint"
          @getWgPubKey="getWgPubKey"
          @newWgKey="newWgKey"
          @addPeer="addWgPeer"
          @delPeer="delWgPeer"
          @refreshPeerKey="refreshWgPeerKey" />
        <Warp v-if="endpoint.type == epTypes.Warp" :data="endpoint" />
        <TailscaleVue v-if="endpoint.type == epTypes.Tailscale" :data="endpoint" />
        <Dial :dial="endpoint" />
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn
          color="primary"
          variant="outlined"
          @click="closeModal"
        >
          {{ $t('actions.close') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="outlined"
          :loading="loading"
          @click="saveChanges(false)"
        >
          {{ $t('actions.save') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="tonal"
          :loading="loading"
          @click="saveChanges(true)"
        >
          {{ $t('actions.saveApply') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { EpTypes, createEndpoint } from '@/types/endpoints'
import RandomUtil from '@/plugins/randomUtil'
import Dial from '@/components/Dial.vue'
import Wireguard from '@/components/protocols/Wireguard.vue'
import Warp from '@/components/protocols/Warp.vue'
import TailscaleVue from '@/components/protocols/Tailscale.vue'
import HttpUtils from '@/plugins/httputil'
import { push } from 'notivue'
import { i18n } from '@/locales'
import Data from '@/store/modules/data'

function cidrHost(cidr: string, hostIndex: number): string {
  const [address, bitsText] = String(cidr || '').trim().split('/')
  const bits = Number(bitsText)
  const ipv6 = address?.includes(':')
  const width = ipv6 ? 128 : 32
  if (!address || !Number.isInteger(bits) || bits < 0 || bits > width) return ''

  let value = 0n
  if (ipv6) {
    const halves = address.split('::')
    if (halves.length > 2) return ''
    const left = halves[0] ? halves[0].split(':') : []
    const right = halves.length === 2 && halves[1] ? halves[1].split(':') : []
    const missing = 8 - left.length - right.length
    if (missing < 0 || (halves.length === 1 && missing !== 0)) return ''
    const groups = [...left, ...Array(missing).fill('0'), ...right]
    for (const group of groups) {
      const parsed = Number.parseInt(group || '0', 16)
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 0xffff) return ''
      value = (value << 16n) | BigInt(parsed)
    }
  } else {
    const parts = address.split('.').map(part => Number(part))
    if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return ''
    for (const part of parts) value = (value << 8n) | BigInt(part)
  }

  const hostBits = BigInt(width - bits)
  const hostCount = 1n << hostBits
  const offset = BigInt(hostIndex)
  if (offset < 1n || offset >= hostCount || (!ipv6 && offset === hostCount - 1n)) return ''
  const network = (value >> hostBits) << hostBits
  const host = network + offset
  if (!ipv6) {
    const parts = [24n, 16n, 8n, 0n].map(shift => Number((host >> shift) & 255n))
    return `${parts.join('.')}/32`
  }
  const groups: string[] = []
  for (let shift = 112n; shift >= 0n; shift -= 16n) groups.push(((host >> shift) & 0xffffn).toString(16))
  return `${groups.join(':')}/128`
}

function canonicalHostPrefix(value: string): string {
  const [address, prefix = ''] = String(value || '').trim().split('/')
  if (!address.includes(':')) return `${address}/${prefix}`
  try {
    return `${new URL(`http://[${address}]/`).hostname.slice(1, -1).toLowerCase()}/${prefix}`
  } catch {
    return `${address.toLowerCase()}/${prefix}`
  }
}

export default {
  props: ['visible', 'data', 'id', 'tags'],
  emits: ['close'],
  data() {
    return {
      endpoint: createEndpoint("wireguard",{ "tag": "" }),
      title: "add",
      tab: "t1",
      loading: false,
      epTypes: EpTypes,
    }
  },
  methods: {
    async updateData(id: number) {
      if (id > 0) {
        const newData = JSON.parse(this.$props.data)
        this.endpoint = createEndpoint(newData.type, newData)
        this.title = "edit"
      }
      else {
        this.endpoint.type = "wireguard"
        this.endpoint.listen_port = RandomUtil.randomIntRange(10000, 60000)
        this.changeType()
        this.title = "add"
      }
      this.tab = "t1"
    },
    async changeType() {
      // Tag change only in add endpoint
      const tag = this.endpoint.type + "-" + RandomUtil.randomSeq(3)
      
      // Use previous data
      let prevConfig = {}
      switch (this.endpoint.type) {
        case EpTypes.Wireguard: {
          const wgKeys = (await this.genWgKey())
          const listenPort = this.endpoint.listen_port ?? RandomUtil.randomIntRange(10000, 60000)
          prevConfig = {
            tag: tag,
            wireguard_schema: 3,
            listen_port: listenPort,
            address: ['10.66.66.1/32', 'fd66:66:66::1/128'],
            tunnel_ipv4_cidr: '10.66.66.0/24',
            tunnel_ipv6_cidr: 'fd66:66:66::/64',
            advertised_endpoint_host: '',
            advertised_endpoint_port: listenPort,
            peer_to_peer_enabled: false,
            hub_peer_forwarding_enabled: false,
            default_client_allowed_ips: ['10.66.66.0/24', 'fd66:66:66::/64'],
            default_client_dns: [],
            default_client_mtu: 1420,
            default_client_keepalive: 25,
            system: false,
            private_key: wgKeys.private_key,
            peers: [],
            ext: {
              public_key: wgKeys.public_key,
              keys: []
            }
          }
          break
        }
        case EpTypes.Warp:
          prevConfig = {
            tag: tag,
          }
          break
        case EpTypes.Tailscale:
          prevConfig = { tag: tag }
          break
      }
      this.endpoint = createEndpoint(this.endpoint.type, prevConfig)
    },
    closeModal() {
      this.updateData(0) // reset
      this.$emit('close')
    },
    async saveChanges(apply = true) {
      if (!this.$props.visible) return
      
      // check duplicate tag
      const isDuplicatedTag = Data().checkTag("endpoint",this.endpoint.id, this.endpoint.tag)
      if (isDuplicatedTag) return

      // save data
      this.loading = true
      const success = await Data().save("endpoints", this.$props.id == 0 ? "new" : "edit", this.endpoint, undefined, apply)
      if (success) this.closeModal()
      this.loading = false
    },
    async genWgKey(){
      this.loading = true
      const msg = await HttpUtils.get('api/keypairs', { k: "wireguard" })
      this.loading = false
      const result = { private_key: "", public_key: "" }
      if (msg.success) {
        msg.obj.forEach((line:string) => {
          if (line.startsWith("PrivateKey")){
            result.private_key = line.substring(12)
          }
          if (line.startsWith("PublicKey")){
            result.public_key = line.substring(11)
          }
        })
      } else {
        push.error({
          message: i18n.global.t('error') + ": " + msg.obj
        })
      }
      return result
    },
    async newWgKey(){
      this.loading = true
      const newKeys = await this.genWgKey()
      this.endpoint.private_key = newKeys.private_key
      if (!this.endpoint.ext) this.endpoint.ext = {keys: []}
      this.endpoint.ext.public_key = newKeys.public_key
      this.loading = false
    },
    async getWgPubKey(private_key: string) {
      if (!this.endpoint.ext) this.endpoint.ext = {keys: []}
      this.loading = true
      const msg = await HttpUtils.get('api/keypairs', { k: "wireguard", o: private_key })
      if (msg.success) {
        this.endpoint.ext.public_key = msg.obj[0]
      }
      this.loading = false
    },
    async addWgPeer(){
      if (this.endpoint.type != EpTypes.Wireguard) return
      this.loading = true
      const newKeys = await this.genWgKey()
      if (!this.endpoint.ext) this.endpoint.ext = {keys: []}
      this.endpoint.ext.keys.push(newKeys)
      const assignedIPv4 = this.findFreeIP(false)
      const assignedIPv6 = this.findFreeIP(true)
      this.endpoint.peers.push({
        name: this.$t('types.wg.peer') + ' ' + (this.endpoint.peers.length + 1),
        peer_mode: 'roaming_client',
        peer_role: 'client',
        remote_endpoint_mode: 'dynamic',
        public_key: newKeys.public_key,
        client_private_key: newKeys.private_key,
        assigned_ipv4: assignedIPv4,
        assigned_ipv6: assignedIPv6,
        server_allowed_ips: [assignedIPv4, assignedIPv6],
        allowed_ips: [assignedIPv4, assignedIPv6],
        client_route_preset: 'virtual_network',
        client_allowed_ips: [this.endpoint.tunnel_ipv4_cidr, this.endpoint.tunnel_ipv6_cidr].filter(Boolean),
        client_dns: [...(this.endpoint.default_client_dns || [])],
        client_mtu: this.endpoint.default_client_mtu || this.endpoint.mtu || 1420,
        client_keepalive: this.endpoint.default_client_keepalive || 25,
        include_ipv4: Boolean(this.endpoint.tunnel_ipv4_cidr),
        include_ipv6: Boolean(this.endpoint.tunnel_ipv6_cidr),
      })
      this.loading = false
    },
    findFreeIP(ipv6: boolean): string{
      const used = new Set(([
        ...(this.endpoint.address || []),
        ...this.endpoint.peers.flatMap((peer: any) => peer.server_allowed_ips || peer.allowed_ips || []),
      ] as string[]).map(canonicalHostPrefix))
      const cidr = ipv6 ? this.endpoint.tunnel_ipv6_cidr : this.endpoint.tunnel_ipv4_cidr
      const limit = ipv6 ? 65536 : 65536
      for (let i = 2; i < limit; i++) {
        const newIP = cidrHost(cidr, i)
        if (!newIP) break
        if (!used.has(canonicalHostPrefix(newIP))) return newIP
      }
      return ''
    },
    delWgPeer(index: number){
      if (this.endpoint.type != EpTypes.Wireguard) return
      this.endpoint.ext.keys = this.endpoint.ext.keys.filter((key: any) => key.public_key != this.endpoint.peers[index].public_key)
      this.endpoint.peers.splice(index, 1)
    },
    async refreshWgPeerKey(index: number) {
      this.loading = true
      const newKeys = await this.genWgKey()
      if (!this.endpoint.ext) this.endpoint.ext = {keys: []}
      const indexKeys = this.endpoint.ext.keys.findIndex((key: any) => key.public_key == this.endpoint.peers[index].public_key)
      this.endpoint.ext.keys[indexKeys == -1 ? this.endpoint.ext.keys.length : indexKeys] = newKeys
      this.endpoint.peers[index].public_key = newKeys.public_key
      this.endpoint.peers[index].client_private_key = newKeys.private_key
      this.endpoint.peers[index].client_private_key_set = true
      this.loading = false
    },
  },
  watch: {
    visible(v) {
      if (v) {
        this.updateData(this.$props.id)
      }
    },
  },
  components: { Dial, Wireguard, Warp, TailscaleVue }
}
</script>
