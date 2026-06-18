<template>
  <v-btn size="small" variant="tonal" prepend-icon="mdi-code-json" @click="open">JSON</v-btn>
  <v-dialog v-model="visible" max-width="920" scrollable>
    <v-card title="Raw JSON editor">
      <v-card-text>
        <v-alert v-if="error" type="error" variant="tonal" class="mb-3">{{ error }}</v-alert>
        <v-textarea v-model="content" auto-grow rows="18" max-rows="28" spellcheck="false" class="json-editor" hide-details />
      </v-card-text>
      <v-card-actions><v-spacer /><v-btn @click="visible = false">Cancel</v-btn><v-btn variant="tonal" @click="format">Format</v-btn><v-btn color="primary" @click="apply">Apply</v-btn></v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
const props = defineProps<{ modelValue: any }>()
const emit = defineEmits<{ 'update:modelValue': [value: any] }>()
const visible = ref(false), content = ref(''), error = ref('')
const open = () => { content.value = JSON.stringify(props.modelValue, null, 2); error.value = ''; visible.value = true }
const parse = () => {
  const value = JSON.parse(content.value)
  if (value == null || Array.isArray(value) || typeof value !== 'object') throw new Error('The root value must be a JSON object')
  return value
}
const format = () => { try { content.value = JSON.stringify(parse(), null, 2); error.value = '' } catch (exception: any) { error.value = exception.message } }
const apply = () => { try { emit('update:modelValue', parse()); error.value = ''; visible.value = false } catch (exception: any) { error.value = exception.message } }
</script>

<style scoped>:deep(.json-editor textarea) { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; line-height: 1.5; }</style>
