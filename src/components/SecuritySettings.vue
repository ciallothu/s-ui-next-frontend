<template>
  <v-card class="mt-4" :loading="loading">
    <v-card-title class="d-flex align-center ga-2">
      <v-icon icon="mdi-shield-account-outline" />
      Login security
      <v-spacer />
      <v-btn icon="mdi-refresh" variant="text" @click="load" />
    </v-card-title>
    <v-divider />
    <v-list lines="two">
      <v-list-item prepend-icon="mdi-two-factor-authentication" title="TOTP two-factor authentication" :subtitle="security.totpEnabled ? 'Enabled' : 'Disabled'">
        <template #append>
          <v-btn v-if="security.totpEnabled" color="warning" variant="tonal" @click="disableDialog = true">Disable</v-btn>
          <v-btn v-else color="primary" variant="tonal" @click="beginTotp">Enable</v-btn>
        </template>
      </v-list-item>
      <v-divider />
      <v-list-item prepend-icon="mdi-passkey" title="Passkeys" :subtitle="methods.passkey ? 'Passwordless login enabled' : 'Enable passkeys in Settings first'">
        <template #append>
          <v-btn color="primary" variant="tonal" :disabled="!methods.passkey || !passkeySupported" @click="addPasskey">Add passkey</v-btn>
        </template>
      </v-list-item>
      <v-list-item v-for="passkey in passkeys" :key="passkey.id" class="ps-12" :title="passkey.name || 'Passkey'" :subtitle="formatDate(passkey.createdAt)">
        <template #append><v-btn icon="mdi-delete-outline" color="error" variant="text" @click="deletePasskey(passkey.id)" /></template>
      </v-list-item>
      <v-divider />
      <v-list-item prepend-icon="mdi-badge-account-horizontal-outline" title="OIDC / SSO" :subtitle="methods.oidc ? 'Enabled on the login page' : 'Disabled'" />
    </v-list>
  </v-card>

  <v-dialog v-model="totpDialog" max-width="520">
    <v-card title="Enable TOTP">
      <v-card-text class="text-center">
        <p class="mb-4">Scan with your authenticator, then enter the current code.</p>
        <QrcodeVue v-if="totp.uri" :value="totp.uri" :size="220" level="M" />
        <v-text-field class="mt-4" v-model="totpCode" label="6-digit code" autocomplete="one-time-code" />
        <v-expansion-panels variant="accordion">
          <v-expansion-panel title="Manual setup key" :text="totp.secret" />
        </v-expansion-panels>
      </v-card-text>
      <v-card-actions><v-spacer /><v-btn @click="totpDialog = false">Cancel</v-btn><v-btn color="primary" @click="enableTotp">Enable</v-btn></v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="recoveryDialog" max-width="520" persistent>
    <v-card title="Save recovery codes">
      <v-card-text><p class="mb-3">Each code works once. Store them somewhere safe.</p><pre class="recovery-codes">{{ recoveryCodes.join('\n') }}</pre></v-card-text>
      <v-card-actions><v-spacer /><v-btn color="primary" @click="recoveryDialog = false">I saved them</v-btn></v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="disableDialog" max-width="460">
    <v-card title="Disable TOTP">
      <v-card-text>
        <v-text-field v-model="password" label="Current password" type="password" />
        <v-text-field v-model="disableCode" label="TOTP or recovery code" />
      </v-card-text>
      <v-card-actions><v-spacer /><v-btn @click="disableDialog = false">Cancel</v-btn><v-btn color="warning" @click="disableTotp">Disable</v-btn></v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import QrcodeVue from 'qrcode.vue'
import { push } from 'notivue'
import HttpUtils from '@/plugins/httputil'
import { registerPasskey } from '@/plugins/webauthn'

const loading = ref(false)
const security = ref<any>({ totpEnabled: false, passkeys: [], methods: {} })
const totp = ref<any>({})
const totpCode = ref('')
const recoveryCodes = ref<string[]>([])
const password = ref('')
const disableCode = ref('')
const totpDialog = ref(false)
const recoveryDialog = ref(false)
const disableDialog = ref(false)
const methods = computed(() => security.value.methods ?? {})
const passkeys = computed(() => security.value.passkeys ?? [])
const passkeySupported = typeof window !== 'undefined' && !!window.PublicKeyCredential

const load = async () => {
  loading.value = true
  const response = await HttpUtils.get('api/security')
  if (response.success) security.value = response.obj ?? security.value
  loading.value = false
}
const beginTotp = async () => {
  const response = await HttpUtils.get('api/totp-begin')
  if (response.success) {
    totp.value = response.obj
    totpCode.value = ''
    totpDialog.value = true
  }
}
const enableTotp = async () => {
  const response = await HttpUtils.post('api/totp-enable', { code: totpCode.value })
  if (response.success) {
    recoveryCodes.value = response.obj?.recoveryCodes ?? []
    totpDialog.value = false
    recoveryDialog.value = true
    await load()
  }
}
const disableTotp = async () => {
  const response = await HttpUtils.post('api/totp-disable', { password: password.value, code: disableCode.value })
  if (response.success) {
    disableDialog.value = false
    password.value = ''
    disableCode.value = ''
    await load()
  }
}
const addPasskey = async () => {
  try {
    const name = window.prompt('Passkey name', navigator.userAgent.includes('Mobile') ? 'Mobile device' : 'Browser') || 'Passkey'
    await registerPasskey(name)
    push.success({ message: 'Passkey registered' })
    await load()
  } catch (error: any) {
    push.error({ message: error?.message ?? String(error) })
  }
}
const deletePasskey = async (id: number) => {
  if (!window.confirm('Delete this passkey?')) return
  const response = await HttpUtils.post('api/passkey-delete', { id })
  if (response.success) await load()
}
const formatDate = (value: number) => value ? new Date(value * 1000).toLocaleString() : 'Never used'

onMounted(load)
</script>

<style scoped>
.recovery-codes { padding: 16px; border-radius: 8px; background: rgb(var(--v-theme-surface-variant)); line-height: 1.7; user-select: all; }
</style>
