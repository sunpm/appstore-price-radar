<script setup lang="ts">
import { computed } from 'vue'
import { formatMoneyParts } from '../../../lib/format'

const props = withDefaults(defineProps<{
  value: number | null | undefined
  currency?: string
  tone?: 'default' | 'blue' | 'orange'
  size?: 'hero' | 'card' | 'inline'
  placeholder?: string
}>(), {
  currency: 'USD',
  tone: 'default',
  size: 'card',
  placeholder: '-',
})

const moneyParts = computed(() => {
  return formatMoneyParts(props.value, props.currency)
})
</script>

<template>
  <span
    v-if="moneyParts"
    class="money-display"
    :class="[
      `money-display--${props.size}`,
      `money-display--${props.tone}`,
    ]"
    :aria-label="moneyParts.value"
    :title="moneyParts.value"
  >
    <span class="money-display__currency">{{ moneyParts.currencyLabel }}</span>
    <span class="money-display__major">{{ moneyParts.major }}</span>
    <span v-if="moneyParts.minor" class="money-display__minor">{{ moneyParts.minor }}</span>
  </span>
  <span
    v-else
    class="money-display money-display--empty"
    :class="`money-display--${props.size}`"
  >
    {{ props.placeholder }}
  </span>
</template>

<style scoped>
.money-display {
  display: inline-flex;
  align-items: baseline;
  gap: var(--money-gap, 0.2rem);
  min-width: 0;
  white-space: nowrap;
  line-height: 0.9;
  color: inherit;
  font-variant-numeric: tabular-nums;
}

.money-display__currency {
  position: relative;
  top: var(--money-currency-offset, -0.02em);
  font-family: 'Manrope', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  font-size: var(--money-currency-size);
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.03em;
  opacity: 0.8;
}

.money-display__major {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: var(--money-major-size);
  font-weight: 700;
  letter-spacing: -0.08em;
  line-height: 0.86;
}

.money-display__minor {
  position: relative;
  top: var(--money-minor-offset, -0.04em);
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: var(--money-minor-size);
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.04em;
  opacity: 0.72;
}

.money-display--hero {
  --money-gap: 0.24rem;
  --money-currency-size: 0.92rem;
  --money-currency-offset: -0.1em;
  --money-major-size: clamp(2.85rem, 5vw, 3.5rem);
  --money-minor-size: 1.02rem;
  --money-minor-offset: -0.18em;
}

.money-display--card {
  --money-gap: 0.18rem;
  --money-currency-size: 0.82rem;
  --money-currency-offset: -0.08em;
  --money-major-size: 1.75rem;
  --money-minor-size: 0.88rem;
  --money-minor-offset: -0.12em;
}

.money-display--inline {
  --money-gap: 0.14rem;
  --money-currency-size: 0.76rem;
  --money-currency-offset: -0.08em;
  --money-major-size: 1.06rem;
  --money-minor-size: 0.72rem;
  --money-minor-offset: -0.1em;
}

.money-display--default {
  color: #0f172a;
}

.money-display--blue {
  color: #1d4ed8;
}

.money-display--orange {
  color: #c2410c;
}

.money-display--empty {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: var(--money-major-size);
  font-weight: 700;
  letter-spacing: -0.06em;
  line-height: 0.9;
}
</style>
