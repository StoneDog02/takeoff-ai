import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RootLayout } from '@/components/Layout'
import { AppLayout } from '@/components/AppLayout'
import { DashboardPage } from '@/routes/DashboardPage'
import { TakeoffPage } from '@/routes/TakeoffPage'
import { BuildListsPage } from '@/routes/BuildListsPage'
import { BuildListDetailPage } from '@/routes/BuildListDetailPage'
import { ProjectsPage } from '@/routes/ProjectsPage'
import { RevenuePage } from '@/pages/RevenuePage'
import { EstimatesPage } from '@/pages/EstimatesPage'
import { TeamsPage } from '@/pages/TeamsPage'
import { DirectoryPage } from '@/pages/DirectoryPage'
import SettingsPage from '@/pages/SettingsPage'
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
      {
        element: <AppLayout />,
        children: [
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'projects', element: <ProjectsPage /> },
          { path: 'projects/:id', element: <ProjectsPage /> },
          { path: 'revenue', element: <RevenuePage /> },
          { path: 'estimates', element: <EstimatesPage /> },
          { path: 'teams', element: <TeamsPage /> },
          { path: 'directory', element: <DirectoryPage /> },
          { path: 'contractors', element: <Navigate to="/directory" replace /> },
          { path: 'messages', element: <DirectoryPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
      { path: 'takeoff', element: <TakeoffPage /> },
      { path: 'build-lists', element: <BuildListsPage /> },
      { path: 'build-lists/:id', element: <BuildListDetailPage /> },
    ],
  },
])
