import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import '@/theme/theme.css'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { PreviewProvider } from '@/contexts/PreviewContext'
import { SubscriptionProvider } from '@/contexts/SubscriptionContext'
import { router } from './router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <SubscriptionProvider>
          <PreviewProvider>
            <Suspense fallback={<LoadingSkeleton variant="page" />}>
              <RouterProvider router={router} />
            </Suspense>
          </PreviewProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
