import { setupServer } from 'msw/node'

/** The fake API: every test declares the answers it needs with server.use(...). Unhandled requests fail the test. */
export const server = setupServer()
