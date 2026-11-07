import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'
import i18n from '@/i18n'
import { tokenStore } from '@/lib/api/tokenStore'
import { server } from './server'
import { waitForIdle } from './utils'

// Waiting for the screen to change (findBy, waitFor) gives up after one second by default. A group page loads the
// group, four reports and the chart library on demand, which takes longer on a busy machine (and tests run in
// parallel). A generous limit costs nothing when everything is fast: a test only waits as long as it needs.
configure({ asyncUtilTimeout: 5000 })

// jsdom has no layout and no ResizeObserver, which the charts use to measure their container:
// give every observed element a size, so the charts draw instead of warning about a 0x0 box
globalThis.ResizeObserver ??= class implements ResizeObserver {
  private readonly callback: ResizeObserverCallback
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }
  observe(target: Element) {
    const box = { width: 640, height: 260, top: 0, left: 0, right: 640, bottom: 260, x: 0, y: 0, toJSON: () => ({}) }
    queueMicrotask(() => this.callback([{ target, contentRect: box } as unknown as ResizeObserverEntry], this))
  }
  unobserve() {}
  disconnect() {}
}

/** The requests a screen sent that the fake server had no answer for, in the test that is running. */
const unanswered: string[] = []

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
  server.events.on('request:unhandled', ({ request }) => {
    unanswered.push(`${request.method} ${new URL(request.url).pathname}${new URL(request.url).search}`)
  })
})

beforeEach(async () => {
  // Recharts warns once about a 0x0 box before the observer above has answered; every other warning stays visible
  const warn = console.warn.bind(console)
  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    if (!String(args[0]).includes('of chart should be greater than 0')) {
      warn(...args)
    }
  })
  localStorage.clear()
  tokenStore.set(null)
  await i18n.changeLanguage('en')
})

afterEach(async () => {
  await waitForIdle()
  cleanup()
  server.resetHandlers()
  const missed = unanswered.splice(0)
  if (missed.length > 0) {
    throw new Error(`The screen sent requests that the test gave no answer to (the test ended too early, or forgot a handler): ${missed.join(' | ')}`)
  }
})

afterAll(() => server.close())
