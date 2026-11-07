import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'
import i18n from '@/i18n'
import { tokenStore } from '@/lib/api/tokenStore'
import { server } from './server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

beforeEach(async () => {
  localStorage.clear()
  tokenStore.set(null)
  await i18n.changeLanguage('en')
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
})

afterAll(() => server.close())
