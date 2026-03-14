import { Suspense, lazy } from 'react'
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
import { LoadingSkeleton } from '@/components/LoadingSkeleton'

const EstimatesPage = lazy(() => import('@/pages/EstimatesPage').then((m) => ({ default: m.EstimatesPage })))
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
import { MessagesPage } from '@/pages/MessagesPage'

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
          { path: 'messages', element: <MessagesPage employeePortal /> },
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
          {
            path: 'estimates',
            element: (
              <Suspense
                fallback={
                  <div className="dashboard-app estimates-page flex flex-col min-h-0 flex-1">
                    <div className="estimates-page__wrap w-full max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-6 flex flex-col flex-1 min-h-0">
                      <LoadingSkeleton variant="page" className="min-h-[30vh]" />
                    </div>
                  </div>
                }
              >
                <EstimatesPage />
              </Suspense>
            ),
          },
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
