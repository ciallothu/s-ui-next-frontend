<template>
    <v-container class="fill-height" style="margin-top: 100px;">
      <v-row justify="center" align="center">
        <v-col cols="12" sm="8" md="4">
          <v-card>
            <v-card-title class="headline">{{ $t('login.title') }}</v-card-title>
            <v-card-text>
              <v-form @submit.prevent="login" ref="form">
                <v-text-field v-model="username" :label="$t('login.username')" :rules="usernameRules" required></v-text-field>
                <v-text-field v-model="password" :label="$t('login.password')" :rules="passwordRules" type="password" required></v-text-field>
				<v-text-field v-if="requires2FA" v-model="otp" :label="$t('auth.twoFactorCode')" autocomplete="one-time-code" autofocus required></v-text-field>
                <v-btn :loading="loading" type="submit" color="primary" block class="mt-2">{{ $t('actions.submit') }}</v-btn>
              </v-form>
			  <v-btn v-if="authMethods.passkey" :disabled="!username" :loading="loading" block variant="tonal" class="mt-2" prepend-icon="mdi-passkey" @click="passkeyLogin">{{ $t('auth.passkey') }}</v-btn>
			  <v-btn v-if="authMethods.oidc" :loading="loading" block variant="outlined" class="mt-2" prepend-icon="mdi-login-variant" @click="oidcLogin">{{ $t('auth.oidcSso') }}</v-btn>
              <v-select
                density="compact"
                class="mt-2"
                hide-details
                variant="solo"
                :items="languages"
                v-model="$i18n.locale"
                @update:modelValue="changeLocale">
                <template v-slot:append>
                  <v-menu>
                    <template v-slot:activator="{ props }">
                      <v-btn icon v-bind="props">
                        <v-icon>mdi-theme-light-dark</v-icon>
                      </v-btn>
                    </template>
                    <v-list>
                      <v-list-item
                        v-for="th in themes"
                        :key="th.value"
                        @click="changeTheme(th.value)"
                        :prepend-icon="th.icon"
                        :active="isActiveTheme(th.value)"
                      >
                        <v-list-item-title>{{ $t(`theme.${th.value}`) }}</v-list-item-title>
                      </v-list-item>
                    </v-list>
                  </v-menu>
                </template>
              </v-select>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </template>

<script lang="ts" setup>
import { onMounted, ref } from "vue"
import { useLocale,useTheme } from 'vuetify'
import { i18n, languages } from '@/locales'
import { useRouter } from 'vue-router'
import HttpUtil from '@/plugins/httputil'
import { loginWithPasskey } from '@/plugins/webauthn'


const theme = useTheme()
const locale = useLocale()

const themes = [
  { value: 'light', icon: 'mdi-white-balance-sunny' },
  { value: 'dark', icon: 'mdi-moon-waning-crescent' },
  { value: 'system', icon: 'mdi-laptop' },
]

const username = ref('')
const usernameRules = [
  (value: string) => {
    if (value?.length > 0) return true
    return i18n.global.t('login.unRules')
  },
]

const password = ref('')
const passwordRules = [
  (value: string) => {
    if (value?.length > 0) return true
    return i18n.global.t('login.pwRules')
  },
]

const loading = ref(false)
const otp = ref('')
const requires2FA = ref(false)
const authMethods = ref({ oidc: false, passkey: false, totp: true })
const router = useRouter()

onMounted(async () => {
  const response = await HttpUtil.get('api/auth-meta')
  if (response.success && response.obj) authMethods.value = { ...authMethods.value, ...response.obj }
})

const login = async () => {
  if (username.value == '' || password.value == '') return
  loading.value = true
  try {
    const response = await HttpUtil.post('api/login',{user: username.value, pass: password.value, otp: otp.value})
    if (!response.success) return
    if (response.obj?.requires2FA) {
      requires2FA.value = true
      return
    }
    requires2FA.value = false
    otp.value = ''
    await router.replace('/')
  } finally {
    loading.value = false
  }
}
const oidcLogin = async () => {
  loading.value = true
  const response = await HttpUtil.get('api/oidc-start')
  loading.value = false
  if (response.success && response.obj?.url) window.location.assign(response.obj.url)
}
const passkeyLogin = async () => {
  if (!username.value) return
  loading.value = true
  try {
	await loginWithPasskey(username.value.trim())
	await router.push('/')
  } finally {
	loading.value = false
  }
}
const changeLocale = (l: any) => {
  locale.current.value = l ?? 'en'
  localStorage.setItem('locale', locale.current.value)
}
const changeTheme = (th: string) => {
  theme.change(th)
  localStorage.setItem('theme', th)
}
const isActiveTheme = (th: string) => {
  const current = localStorage.getItem('theme') ?? 'system'
  return current == th
}
</script>
