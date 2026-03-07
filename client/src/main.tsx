import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import '@/theme/theme.css'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { PreviewProvider } from '@/contexts/PreviewContext'
import { router } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <PreviewProvider>
          <RouterProvider router={router} />
        </PreviewProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
