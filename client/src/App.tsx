import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RootLayout } from '@/components/Layout'
import { AppLayout } from '@/components/AppLayout'
import { EmployeeLayout } from '@/components/EmployeeLayout'
import { DashboardPage } from '@/routes/DashboardPage'
import { TakeoffPage } from '@/routes/TakeoffPage'
import { BuildListsPage } from '@/routes/BuildListsPage'
import { BuildListDetailPage } from '@/routes/BuildListDetailPage'
import { ProjectsPage } from '@/routes/ProjectsPage'
import { RevenuePage } from '@/pages/RevenuePage'
import { AccountingPage } from '@/pages/AccountingPage'
import { EstimatesPage } from '@/pages/EstimatesPage'
import { TeamsPage } from '@/pages/TeamsPage'
import { PayrollPage } from '@/pages/PayrollPage'
import { DirectoryPage } from '@/pages/DirectoryPage'
import SettingsPage from '@/pages/SettingsPage'
import { AdminPage } from '@/pages/AdminPage'
import { AdminGuard } from '@/components/AdminGuard'
import { LandingPage } from '@/routes/LandingPage'
import { PrivacyPage } from '@/routes/PrivacyPage'
import { TermsPage } from '@/routes/TermsPage'
import { SignInPage } from '@/routes/SignInPage'
import { SignUpPage } from '@/routes/SignUpPage'
import { AcceptInvitePage } from '@/routes/AcceptInvitePage'
import { EmployeeClockPage } from '@/routes/EmployeeClockPage'
import { EmployeeHoursPage } from '@/routes/EmployeeHoursPage'
import { EmployeeJobsPage } from '@/routes/EmployeeJobsPage'
import { EmployeeProfilePage } from '@/routes/EmployeeProfilePage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'landing', element: <LandingPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'terms', element: <TermsPage /> },
      { path: 'sign-in', element: <SignInPage /> },
      { path: 'sign-up', element: <SignUpPage /> },
      { path: 'accept-invite', element: <AcceptInvitePage /> },
      {
        path: 'employee',
        element: <EmployeeLayout />,
        children: [
          { index: true, element: <Navigate to="/employee/clock" replace /> },
          { path: 'clock', element: <EmployeeClockPage /> },
          { path: 'hours', element: <EmployeeHoursPage /> },
          { path: 'jobs', element: <EmployeeJobsPage /> },
          { path: 'profile', element: <EmployeeProfilePage /> },
        ],
      },
      {
        element: <AppLayout />,
        children: [
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'projects', element: <ProjectsPage /> },
          { path: 'projects/:id', element: <ProjectsPage /> },
          { path: 'revenue', element: <RevenuePage /> },
          { path: 'accounting', element: <AccountingPage /> },
          { path: 'estimates', element: <EstimatesPage /> },
          { path: 'teams', element: <TeamsPage /> },
          { path: 'payroll', element: <PayrollPage /> },
          { path: 'directory', element: <DirectoryPage /> },
          { path: 'contractors', element: <Navigate to="/directory" replace /> },
          { path: 'messages', element: <Navigate to="/directory" replace /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'admin', element: <AdminGuard><AdminPage /></AdminGuard> },
        ],
      },
      { path: 'takeoff', element: <TakeoffPage /> },
      { path: 'build-lists', element: <BuildListsPage /> },
      { path: 'build-lists/:id', element: <BuildListDetailPage /> },
    ],
  },
])
