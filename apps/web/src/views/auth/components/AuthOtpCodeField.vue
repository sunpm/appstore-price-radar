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

function readInputValue(event: Event): string {
  return (event.target as HTMLInputElement).value
}

function onInput(event: Event): void {
  model.value = readInputValue(event)
}
</script>

<template>
  <div class="grid gap-2">
    <span class="text-sm font-medium text-zinc-700">{{ props.label }}</span>
    <div
      class="flex items-stretch rounded-xl border border-zinc-300/80 bg-white transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100"
    >
      <input
        :value="model"
        type="text"
        maxlength="6"
        inputmode="numeric"
        :placeholder="props.placeholder"
        required
        class="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
        @input="onInput"
      >
      <button
        class="inline-flex w-[112px] shrink-0 items-center justify-center whitespace-nowrap border-l border-zinc-200 px-3 py-2.5 text-sm font-medium text-zinc-700 transition duration-300 hover:bg-zinc-50 hover:text-zinc-900 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
        type="button"
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
  </div>
</template>
