import { useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { createQueryClient } from '@/lib/queryClient'
import { appRoutes } from '@/routes/appRoutes'

const router = createBrowserRouter(appRoutes)

export default function App() {
  const [queryClient] = useState(createQueryClient)
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div data-theme="light" className="q-root">
          <RouterProvider router={router} />
        </div>
      </AuthProvider>
    </QueryClientProvider>
  )
}
