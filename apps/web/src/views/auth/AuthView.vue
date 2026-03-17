<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { clearStoredToken, getStoredToken, setStoredToken } from '../../lib/auth-session';
import { useToast } from '../../lib/toast';
import AuthCredentialForms from './components/AuthCredentialForms.vue';
import AuthHeaderBlock from './components/AuthHeaderBlock.vue';
import AuthModeSwitcher from './components/AuthModeSwitcher.vue';
import AuthSessionPanel from './components/AuthSessionPanel.vue';

type AuthUser = {
  id: string;
  email: string;
};

type AuthResponse = {
  token: string;
  expiresAt: string;
  user: AuthUser;
};

type SendCodeResponse = {
  ok: boolean;
  cooldownSeconds?: number;
  retryAfterSeconds?: number;
  error?: string;
};

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '');
const buildApiUrl = (path: string) => `${API_BASE ?? ''}${path}`;

const router = useRouter();
const props = withDefaults(
  defineProps<{
    mode?: 'page' | 'modal';
    redirectOnSuccess?: boolean;
  }>(),
  {
    mode: 'page',
    redirectOnSuccess: false,
  },
);
const emit = defineEmits<{
  authenticated: [];
}>();

const authMode = ref<'login' | 'register' | 'code'>('login');
const showResetPanel = ref(false);
const isPageMode = computed(() => props.mode === 'page');
const loginCodeCooldownSeconds = ref(0);
const loginCodeCanResend = computed(() => loginCodeCooldownSeconds.value <= 0);

let loginCodeCooldownTimer: ReturnType<typeof setInterval> | null = null;

const authForm = reactive({
  email: '',
  password: '',
});

const codeForm = reactive({
  email: '',
  code: '',
});

const resetForm = reactive({
  email: '',
  token: '',
  newPassword: '',
});

const token = ref(getStoredToken());
const currentUser = ref<AuthUser | null>(null);
const sessionExpiresAt = ref('');
const restoringSession = ref(true);
const toast = useToast();

const authLoading = ref(false);
const codeSending = ref(false);
const codeVerifying = ref(false);
const resetSending = ref(false);
const resetSubmitting = ref(false);

const successText = ref('');
const errorText = ref('');

watch(successText, (next) => {
  if (!next) {
    return;
  }

  toast.success(next);
});

watch(errorText, (next) => {
  if (!next) {
    return;
  }

  toast.error(next);
});

const resetMessages = () => {
  successText.value = '';
  errorText.value = '';
};

const setAuthMode = (mode: 'login' | 'register' | 'code') => {
  authMode.value = mode;
  if (mode !== 'login') {
    showResetPanel.value = false;
  }
};

const clearLoginCodeCooldownTimer = () => {
  if (loginCodeCooldownTimer) {
    clearInterval(loginCodeCooldownTimer);
    loginCodeCooldownTimer = null;
  }
};

const startLoginCodeCooldown = (seconds: number) => {
  clearLoginCodeCooldownTimer();

  loginCodeCooldownSeconds.value = Math.max(0, Math.floor(seconds));

  if (loginCodeCooldownSeconds.value <= 0) {
    return;
  }

  loginCodeCooldownTimer = setInterval(() => {
    loginCodeCooldownSeconds.value = Math.max(0, loginCodeCooldownSeconds.value - 1);

    if (loginCodeCooldownSeconds.value <= 0) {
      clearLoginCodeCooldownTimer();
    }
  }, 1000);
};

const setPrimaryEmail = (email: string) => {
  const next = email.trim();

  if (!next) {
    return;
  }

  authForm.email = next;
  codeForm.email = next;
  resetForm.email = next;
};

const toTime = (value: string) => {
  return new Date(value).toLocaleString();
};

const clearSession = () => {
  token.value = '';
  currentUser.value = null;
  sessionExpiresAt.value = '';
  clearStoredToken();
};

const applySession = (next: AuthResponse) => {
  token.value = next.token;
  currentUser.value = next.user;
  sessionExpiresAt.value = next.expiresAt;
  setStoredToken(next.token);
  setPrimaryEmail(next.user.email);
};

const parseErrorText = async (res: Response): Promise<string> => {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? `Request failed with status ${res.status}`;
  } catch {
    return `Request failed with status ${res.status}`;
  }
};

const apiRequest = async <T>(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean } = {},
): Promise<T> => {
  const headers = new Headers(init.headers ?? {});

  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  if (options.auth) {
    if (!token.value) {
      throw new Error('Please login first');
    }

    headers.set('authorization', `Bearer ${token.value}`);
  }

  const res = await fetch(buildApiUrl(path), {
    ...init,
    headers,
  });

  if (!res.ok) {
    if (options.auth && res.status === 401) {
      clearSession();
    }

    throw new Error(await parseErrorText(res));
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
};

const loadCurrentUser = async () => {
  if (!token.value) {
    restoringSession.value = false;
    return;
  }

  try {
    const me = await apiRequest<{ user: AuthUser }>('/api/auth/me', {}, { auth: true });
    currentUser.value = me.user;
    setPrimaryEmail(me.user.email);
  } catch {
    clearSession();
  } finally {
    restoringSession.value = false;
  }
};

const onAuthenticated = async () => {
  emit('authenticated');

  if (props.redirectOnSuccess) {
    await router.push('/profile');
  }
};

const submitAuth = async () => {
  resetMessages();

  const email = authForm.email.trim();
  const password = authForm.password;

  if (!email || !password) {
    errorText.value = '请填写邮箱和密码。';
    return;
  }

  if (password.length < 8) {
    errorText.value = '密码长度需不少于 8 位。';
    return;
  }

  authLoading.value = true;

  try {
    const path = authMode.value === 'register' ? '/api/auth/register' : '/api/auth/login';
    const data = await apiRequest<AuthResponse>(path, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    applySession(data);
    authForm.password = '';
    successText.value =
      authMode.value === 'register'
        ? props.redirectOnSuccess
          ? '账号创建成功，正在进入工作台。'
          : '账号创建成功。'
        : props.redirectOnSuccess
          ? '登录成功，正在进入工作台。'
          : '登录成功。';

    await onAuthenticated();
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '登录失败，请稍后重试。';
  } finally {
    authLoading.value = false;
  }
};

const sendLoginCode = async () => {
  resetMessages();

  const email = codeForm.email.trim();

  if (!email) {
    errorText.value = '请输入邮箱地址。';
    return;
  }

  if (!loginCodeCanResend.value) {
    errorText.value = `发送过于频繁，请在 ${loginCodeCooldownSeconds.value} 秒后重试。`;
    return;
  }

  codeSending.value = true;

  try {
    const res = await fetch(buildApiUrl('/api/auth/send-login-code'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const payload = (await res.json().catch(() => ({}))) as SendCodeResponse;

    if (!res.ok) {
      if (res.status === 429 && payload.retryAfterSeconds) {
        startLoginCodeCooldown(payload.retryAfterSeconds);
      }

      throw new Error(payload.error ?? `Request failed with status ${res.status}`);
    }

    setPrimaryEmail(email);
    const cooldownSeconds = payload.cooldownSeconds ?? 60;
    startLoginCodeCooldown(cooldownSeconds);
    successText.value = `登录验证码已发送，请前往邮箱查收。${cooldownSeconds > 0 ? ` ${cooldownSeconds} 秒后可重新发送。` : ''}`;
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '验证码发送失败，请稍后重试。';
  } finally {
    codeSending.value = false;
  }
};

const verifyLoginCode = async () => {
  resetMessages();

  const email = codeForm.email.trim();
  const code = codeForm.code.trim();

  if (!email || !code) {
    errorText.value = '请填写邮箱和验证码。';
    return;
  }

  if (!/^\d{6}$/.test(code)) {
    errorText.value = '验证码需为 6 位数字。';
    return;
  }

  codeVerifying.value = true;

  try {
    const data = await apiRequest<AuthResponse>('/api/auth/verify-login-code', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });

    applySession(data);
    codeForm.code = '';
    successText.value = props.redirectOnSuccess ? '验证成功，正在进入工作台。' : '验证成功，已完成登录。';

    await onAuthenticated();
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '验证码登录失败，请稍后重试。';
  } finally {
    codeVerifying.value = false;
  }
};

const sendResetEmail = async () => {
  resetMessages();

  const email = resetForm.email.trim();

  if (!email) {
    errorText.value = '请输入邮箱地址。';
    return;
  }

  resetSending.value = true;

  try {
    await apiRequest<{ ok: boolean }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });

    setPrimaryEmail(email);
    successText.value = '若邮箱已注册，重置邮件已发送，请注意查收。';
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '重置邮件发送失败，请稍后重试。';
  } finally {
    resetSending.value = false;
  }
};

const openResetPanel = () => {
  authMode.value = 'login';
  showResetPanel.value = true;
};

const closeResetPanel = () => {
  showResetPanel.value = false;
};

const resetPassword = async () => {
  resetMessages();

  const tokenText = resetForm.token.trim();
  const newPassword = resetForm.newPassword;

  if (!tokenText || !newPassword) {
    errorText.value = '请填写重置令牌和新密码。';
    return;
  }

  if (newPassword.length < 8) {
    errorText.value = '新密码长度需不少于 8 位。';
    return;
  }

  resetSubmitting.value = true;

  try {
    await apiRequest<{ ok: boolean }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: tokenText, password: newPassword }),
    });

    resetForm.newPassword = '';
    authMode.value = 'login';
    showResetPanel.value = false;
    successText.value = '密码已更新，请使用新密码重新登录。';
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '密码重置失败，请稍后重试。';
  } finally {
    resetSubmitting.value = false;
  }
};

const logout = async () => {
  resetMessages();

  try {
    await apiRequest<{ ok: boolean }>(
      '/api/auth/logout',
      {
        method: 'POST',
      },
      { auth: true },
    );
  } catch {
    // Ignore server logout errors and clear local session anyway.
  }

  clearSession();
  successText.value = '已安全退出登录。';
};

onMounted(async () => {
  if (isPageMode.value) {
    const url = new URL(window.location.href);
    const resetToken = url.searchParams.get('reset_token');

    if (resetToken) {
      resetForm.token = resetToken;
      showResetPanel.value = true;
      successText.value = '已识别重置令牌，请填写新密码后提交。';
      url.searchParams.delete('reset_token');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }

  await loadCurrentUser();
});

onBeforeUnmount(() => {
  clearLoginCodeCooldownTimer();
});
</script>

<template>
  <main :class="[isPageMode ? 'min-h-[100dvh] bg-zinc-100' : '', 'text-zinc-900']">
    <div
      v-if="isPageMode"
      class="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_12%_10%,rgba(16,185,129,0.16),transparent_34%),radial-gradient(circle_at_88%_6%,rgba(15,23,42,0.08),transparent_35%),linear-gradient(160deg,#f4f7f7_0%,#eef3f2_48%,#f8f8f8_100%)]"
    ></div>

    <div :class="isPageMode ? 'mx-auto max-w-[980px] px-4 py-6 md:px-8 md:py-10' : ''">
      <section
        :class="
          isPageMode
            ? 'reveal rounded-[2rem] border border-zinc-200/70 bg-white/92 p-6 shadow-[0_20px_40px_-15px_rgba(7,13,20,0.1)]'
            : 'rounded-[1.5rem] border border-zinc-200/80 bg-white p-5 shadow-[0_18px_38px_-16px_rgba(7,13,20,0.22)] md:p-6'
        "
      >
        <AuthHeaderBlock :is-page-mode="isPageMode" />

        <div v-if="restoringSession" class="mt-4 grid gap-3 md:grid-cols-2">
          <div class="skeleton-box h-24 rounded-2xl"></div>
          <div class="skeleton-box h-24 rounded-2xl"></div>
        </div>

        <AuthSessionPanel
          v-else-if="currentUser"
          :current-user="currentUser"
          :session-expires-at="sessionExpiresAt"
          :to-time="toTime"
          @logout="logout"
        />

        <template v-else>
          <AuthModeSwitcher v-if="!showResetPanel" :mode="authMode" @change="setAuthMode" />

          <AuthCredentialForms
            :auth-mode="authMode"
            :show-reset-panel="showResetPanel"
            :auth-loading="authLoading"
            :code-sending="codeSending"
            :code-verifying="codeVerifying"
            :reset-sending="resetSending"
            :reset-submitting="resetSubmitting"
            :login-code-cooldown-seconds="loginCodeCooldownSeconds"
            :login-code-can-resend="loginCodeCanResend"
            v-model:auth-email="authForm.email"
            v-model:auth-password="authForm.password"
            v-model:code-email="codeForm.email"
            v-model:code="codeForm.code"
            v-model:reset-email="resetForm.email"
            v-model:reset-token="resetForm.token"
            v-model:reset-new-password="resetForm.newPassword"
            @submit-auth="submitAuth"
            @send-login-code="sendLoginCode"
            @verify-login-code="verifyLoginCode"
            @open-reset-panel="openResetPanel"
            @close-reset-panel="closeResetPanel"
            @send-reset-email="sendResetEmail"
            @reset-password="resetPassword"
            @sync-primary-email="setPrimaryEmail"
          />
        </template>

      </section>
    </div>
  </main>
</template>
