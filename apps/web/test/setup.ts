import type { Router } from 'vue-router'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory } from 'vue-router'
import { afterEach, beforeEach, vi } from 'vitest'

const fetchMock = vi.fn<typeof fetch>()

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

vi.stubGlobal('fetch', fetchMock)
vi.stubGlobal('ResizeObserver', ResizeObserverMock)

beforeEach(() => {
  fetchMock.mockReset()
  localStorage.clear()
  sessionStorage.clear()
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.useRealTimers()
})

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)

  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  })
}

export function textResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(body, init)
}

export async function settlePromises(rounds = 3): Promise<void> {
  for (let index = 0; index < rounds; index += 1) {
    await flushPromises()
  }
}

export async function mountAppAt(
  path: string,
): Promise<{ router: Router, wrapper: VueWrapper }> {
  const [{ default: App }, { createAppRouter }] = await Promise.all([
    import('../src/App.vue'),
    import('../src/router'),
  ])

  const router = createAppRouter(createMemoryHistory())
  await router.push(path)
  await router.isReady()

  const wrapper = mount(App, {
    attachTo: document.body,
    global: {
      plugins: [router],
    },
  })

  await settlePromises()

  return { router, wrapper }
}

export { fetchMock }
