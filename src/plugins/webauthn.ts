import api from './api'

const decode = (value: string): ArrayBuffer => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}

const encode = (value: ArrayBuffer | null): string | null => {
  if (value == null) return null
  const bytes = new Uint8Array(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const publicKeyOptions = (payload: any, registration: boolean): PublicKeyCredentialCreationOptions | PublicKeyCredentialRequestOptions => {
  const source = structuredClone(payload?.publicKey ?? payload?.response ?? payload)
  source.challenge = decode(source.challenge)
  if (registration) {
    source.user.id = decode(source.user.id)
    source.excludeCredentials = (source.excludeCredentials ?? []).map((item: any) => ({ ...item, id: decode(item.id) }))
  } else {
    source.allowCredentials = (source.allowCredentials ?? []).map((item: any) => ({ ...item, id: decode(item.id) }))
  }
  return source
}

const serialize = (credential: PublicKeyCredential): any => {
  const response: any = credential.response
  const result: any = {
    id: credential.id,
    type: credential.type,
    rawId: encode(credential.rawId),
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: credential.authenticatorAttachment,
    response: {
      clientDataJSON: encode(response.clientDataJSON),
    },
  }
  if (response.attestationObject) {
    result.response.attestationObject = encode(response.attestationObject)
    result.response.transports = typeof response.getTransports === 'function' ? response.getTransports() : []
  } else {
    result.response.authenticatorData = encode(response.authenticatorData)
    result.response.signature = encode(response.signature)
    result.response.userHandle = encode(response.userHandle)
  }
  return result
}

const unwrap = (response: any) => {
  const value = response.data
  if (!value?.success) throw new Error(value?.msg || 'WebAuthn request failed')
  return value.obj
}

export async function registerPasskey(name = 'Passkey') {
  const begin = unwrap(await api.get('api/passkey-register-begin'))
  const credential = await navigator.credentials.create({ publicKey: publicKeyOptions(begin.options, true) as PublicKeyCredentialCreationOptions }) as PublicKeyCredential | null
  if (!credential) throw new Error('Passkey registration was cancelled')
  unwrap(await api.post(`api/passkey-register-finish?sessionId=${encodeURIComponent(begin.sessionId)}&name=${encodeURIComponent(name)}`, serialize(credential), {
    headers: { 'Content-Type': 'application/json', 'X-WebAuthn-Session': begin.sessionId },
  }))
}

export async function loginWithPasskey(username: string) {
  const begin = unwrap(await api.get('api/passkey-login-begin', { params: { username } }))
  const credential = await navigator.credentials.get({ publicKey: publicKeyOptions(begin.options, false) as PublicKeyCredentialRequestOptions }) as PublicKeyCredential | null
  if (!credential) throw new Error('Passkey login was cancelled')
  return unwrap(await api.post(`api/passkey-login-finish?sessionId=${encodeURIComponent(begin.sessionId)}`, serialize(credential), {
    headers: { 'Content-Type': 'application/json', 'X-WebAuthn-Session': begin.sessionId },
  }))
}
