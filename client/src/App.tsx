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
import { FinancialsLayout } from '@/pages/FinancialsLayout'
import { FinancialsTransactionsPage } from '@/pages/FinancialsTransactionsPage'
import { FinancialsReportsPage } from '@/pages/FinancialsReportsPage'
import { FinancialsInvoicingPage } from '@/pages/FinancialsInvoicingPage'
import { DocumentsPage } from '@/pages/DocumentsPage'
import { AccountingPage } from '@/pages/AccountingPage'
import { PayrollPage } from '@/pages/PayrollPage'
import { DirectoryPage } from '@/pages/DirectoryPage'
import { TeamsPage } from '@/pages/TeamsPage'
import SettingsPage from '@/pages/SettingsPage'
import { AdminPage } from '@/pages/AdminPage'
import { SupportInboxPage } from '@/pages/admin/SupportInboxPage'
import { AdminGuard } from '@/components/AdminGuard'
import { LandingPage } from '@/routes/LandingPage'
import { PrivacyPage } from '@/routes/PrivacyPage'
import { TermsPage } from '@/routes/TermsPage'
import { SignInPage } from '@/routes/SignInPage'
import { SignUpPage } from '@/routes/SignUpPage'
import { AuthCallbackPage } from '@/routes/AuthCallbackPage'
import { AcceptInvitePage } from '@/routes/AcceptInvitePage'
import { EmployeeClockPage } from '@/routes/EmployeeClockPage'
import { EmployeeHoursPage } from '@/routes/EmployeeHoursPage'
import { EmployeeJobsPage } from '@/routes/EmployeeJobsPage'
import { EmployeeProfilePage } from '@/routes/EmployeeProfilePage'
import { EmployeeDailyLogsPage } from '@/routes/EmployeeDailyLogsPage'
import { MessagesPage } from '@/pages/MessagesPage'
import { BidPortal } from '@/pages/BidPortal'
import { EstimatePortal } from '@/pages/EstimatePortal'
import { InvoicePortal } from '@/pages/InvoicePortal'
import { PortalLayout } from '@/components/PortalLayout'

export const router = createBrowserRouter([
  {
    element: <PortalLayout />,
    children: [
      { path: '/bid/:token', element: <BidPortal /> },
      { path: '/estimate/:token', element: <EstimatePortal /> },
      { path: '/invoice/:token', element: <InvoicePortal /> },
    ],
  },
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
      { path: 'auth/callback', element: <AuthCallbackPage /> },
      { path: 'accept-invite', element: <AcceptInvitePage /> },
      {
        path: 'employee',
        element: <EmployeeLayout />,
        children: [
          { index: true, element: <Navigate to="/employee/clock" replace /> },
          { path: 'clock', element: <EmployeeClockPage /> },
          { path: 'hours', element: <EmployeeHoursPage /> },
          { path: 'jobs', element: <EmployeeJobsPage /> },
          { path: 'daily-logs', element: <EmployeeDailyLogsPage /> },
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
          {
            path: 'financials',
            element: <FinancialsLayout />,
            children: [
              { index: true, element: <Navigate to="/financials/overview" replace /> },
              { path: 'overview', element: <RevenuePage /> },
              { path: 'transactions', element: <FinancialsTransactionsPage /> },
              { path: 'reports', element: <FinancialsReportsPage /> },
              { path: 'invoicing', element: <FinancialsInvoicingPage /> },
            ],
          },
          { path: 'revenue', element: <Navigate to="/financials" replace /> },
          { path: 'accounting', element: <AccountingPage /> },
          { path: 'documents', element: <DocumentsPage /> },
          { path: 'estimates', element: <Navigate to="/financials/invoicing" replace /> },
          { path: 'payroll', element: <PayrollPage /> },
          { path: 'teams', element: <TeamsPage /> },
          { path: 'directory', element: <DirectoryPage /> },
          { path: 'contractors', element: <Navigate to="/directory" replace /> },
          { path: 'messages', element: <Navigate to="/directory" replace /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'admin', element: <AdminGuard><AdminPage /></AdminGuard> },
          { path: 'admin/support', element: <AdminGuard><SupportInboxPage /></AdminGuard> },
        ],
      },
      { path: 'takeoff', element: <TakeoffPage /> },
      { path: 'build-lists', element: <BuildListsPage /> },
      { path: 'build-lists/:id', element: <BuildListDetailPage /> },
    ],
  },
])
