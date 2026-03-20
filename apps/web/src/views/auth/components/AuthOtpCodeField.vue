<script setup lang="ts">
const props = defineProps<{
  label: string
  placeholder: string
  sending: boolean
  canResend: boolean
  cooldownSeconds: number
}>()

const emit = defineEmits<{
  send: []
}>()

const model = defineModel<string>({ required: true })

function onInput(event: Event): void {
  model.value = (event.target as HTMLInputElement).value
}
</script>

<template>
  <label class="grid gap-2">
    <span class="text-sm font-semibold text-slate-700">{{ props.label }}</span>
    <div class="flex items-stretch rounded-[1.2rem] border border-slate-200 bg-white/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)] transition duration-300 focus-within:border-blue-300 focus-within:shadow-[0_0_0_4px_rgba(37,99,235,0.1)]">
      <input
        :value="model"
        type="text"
        maxlength="6"
        inputmode="numeric"
        :placeholder="props.placeholder"
        required
        class="min-w-0 flex-1 rounded-l-[1.2rem] border-0 bg-transparent px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
        @input="onInput"
      >
      <button
        type="button"
        class="inline-flex w-[128px] shrink-0 items-center justify-center rounded-r-[1.2rem] border-l border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700 transition duration-300 hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="props.sending || !props.canResend"
        @click="emit('send')"
      >
        {{
          props.sending
            ? '发送中...'
            : props.canResend
              ? '发送验证码'
              : `重发(${props.cooldownSeconds}s)`
        }}
      </button>
    </div>
  </label>
</template>
