import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RootLayout } from '@/components/Layout'
import { TakeoffPage } from '@/routes/TakeoffPage'
import { BuildListsPage } from '@/routes/BuildListsPage'
import { BuildListDetailPage } from '@/routes/BuildListDetailPage'
import { LandingPage } from '@/routes/LandingPage'
import { SignInPage } from '@/routes/SignInPage'
import { SignUpPage } from '@/routes/SignUpPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'landing', element: <LandingPage /> },
      { path: 'sign-in', element: <SignInPage /> },
      { path: 'sign-up', element: <SignUpPage /> },
      { path: 'takeoff', element: <TakeoffPage /> },
      { path: 'build-lists', element: <BuildListsPage /> },
      { path: 'build-lists/:id', element: <BuildListDetailPage /> },
    ],
  },
])
