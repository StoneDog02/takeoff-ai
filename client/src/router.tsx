import { lazy } from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { RootLayout } from "@/components/Layout";
import { AdminGuard } from "@/components/AdminGuard";
import { RouteErrorPage } from "@/components/RouteErrorPage";
import { SubscriptionRoute } from "@/components/gates/SubscriptionRoute";

/** Code-split: one async chunk per layout / page to keep the entry bundle small. */
const PortalLayout = lazy(() =>
  import("@/components/PortalLayout").then((m) => ({ default: m.PortalLayout })),
);
const BidPortal = lazy(() => import("@/pages/BidPortal").then((m) => ({ default: m.BidPortal })));
const EstimatePortal = lazy(() =>
  import("@/pages/EstimatePortal").then((m) => ({ default: m.EstimatePortal })),
);
const InvoicePortal = lazy(() =>
  import("@/pages/InvoicePortal").then((m) => ({ default: m.InvoicePortal })),
);

const AppLayout = lazy(() => import("@/components/AppLayout").then((m) => ({ default: m.AppLayout })));
const EmployeeLayout = lazy(() =>
  import("@/components/EmployeeLayout").then((m) => ({ default: m.EmployeeLayout })),
);

const DashboardPage = lazy(() =>
  import("@/routes/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const TakeoffPage = lazy(() => import("@/routes/TakeoffPage").then((m) => ({ default: m.TakeoffPage })));
const BuildListsPage = lazy(() =>
  import("@/routes/BuildListsPage").then((m) => ({ default: m.BuildListsPage })),
);
const BuildListDetailPage = lazy(() =>
  import("@/routes/BuildListDetailPage").then((m) => ({ default: m.BuildListDetailPage })),
);
const ProjectsPage = lazy(() =>
  import("@/routes/ProjectsPage").then((m) => ({ default: m.ProjectsPage })),
);
const RevenuePage = lazy(() => import("@/pages/RevenuePage").then((m) => ({ default: m.RevenuePage })));
const FinancialsLayout = lazy(() =>
  import("@/pages/FinancialsLayout").then((m) => ({ default: m.FinancialsLayout })),
);
const FinancialsTransactionsPage = lazy(() =>
  import("@/pages/FinancialsTransactionsPage").then((m) => ({ default: m.FinancialsTransactionsPage })),
);
const FinancialsReportsPage = lazy(() =>
  import("@/pages/FinancialsReportsPage").then((m) => ({ default: m.FinancialsReportsPage })),
);
const FinancialsInvoicingPage = lazy(() =>
  import("@/pages/FinancialsInvoicingPage").then((m) => ({ default: m.FinancialsInvoicingPage })),
);
const DocumentsPage = lazy(() =>
  import("@/pages/DocumentsPage").then((m) => ({ default: m.DocumentsPage })),
);
const AccountingPage = lazy(() =>
  import("@/pages/AccountingPage").then((m) => ({ default: m.AccountingPage })),
);
const PayrollPage = lazy(() => import("@/pages/PayrollPage").then((m) => ({ default: m.PayrollPage })));
const DirectoryPage = lazy(() =>
  import("@/pages/DirectoryPage").then((m) => ({ default: m.DirectoryPage })),
);
const TeamsPage = lazy(() => import("@/pages/TeamsPage").then((m) => ({ default: m.TeamsPage })));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const AdminPage = lazy(() => import("@/pages/AdminPage").then((m) => ({ default: m.AdminPage })));
const SupportInboxPage = lazy(() =>
  import("@/pages/admin/SupportInboxPage").then((m) => ({ default: m.SupportInboxPage })),
);
const AffiliatesAdminPage = lazy(() =>
  import("@/pages/admin/AffiliatesAdminPage").then((m) => ({ default: m.AffiliatesAdminPage })),
);

const LandingPage = lazy(() =>
  import("@/routes/LandingPage").then((m) => ({ default: m.LandingPage })),
);
const PrivacyPage = lazy(() =>
  import("@/routes/PrivacyPage").then((m) => ({ default: m.PrivacyPage })),
);
const TermsPage = lazy(() => import("@/routes/TermsPage").then((m) => ({ default: m.TermsPage })));
const SignInPage = lazy(() => import("@/routes/SignInPage").then((m) => ({ default: m.SignInPage })));
const SignUpPage = lazy(() => import("@/routes/SignUpPage").then((m) => ({ default: m.SignUpPage })));
const AuthCallbackPage = lazy(() =>
  import("@/routes/AuthCallbackPage").then((m) => ({ default: m.AuthCallbackPage })),
);
const AcceptInvitePage = lazy(() =>
  import("@/routes/AcceptInvitePage").then((m) => ({ default: m.AcceptInvitePage })),
);
const AffiliateSetupPage = lazy(() =>
  import("@/routes/AffiliateSetupPage").then((m) => ({ default: m.AffiliateSetupPage })),
);
const AffiliateGuard = lazy(() =>
  import("@/components/AffiliateGuard").then((m) => ({ default: m.AffiliateGuard })),
);
const AffiliateDashboardPage = lazy(() =>
  import("@/pages/AffiliateDashboardPage").then((m) => ({ default: m.AffiliateDashboardPage })),
);

const EmployeeClockPage = lazy(() =>
  import("@/routes/EmployeeClockPage").then((m) => ({ default: m.EmployeeClockPage })),
);
const EmployeeHoursPage = lazy(() =>
  import("@/routes/EmployeeHoursPage").then((m) => ({ default: m.EmployeeHoursPage })),
);
const EmployeeJobsPage = lazy(() =>
  import("@/routes/EmployeeJobsPage").then((m) => ({ default: m.EmployeeJobsPage })),
);
const EmployeeProfilePage = lazy(() =>
  import("@/routes/EmployeeProfilePage").then((m) => ({ default: m.EmployeeProfilePage })),
);
const EmployeeDailyLogsPage = lazy(() =>
  import("@/routes/EmployeeDailyLogsPage").then((m) => ({ default: m.EmployeeDailyLogsPage })),
);
const MessagesPage = lazy(() =>
  import("@/pages/MessagesPage").then((m) => ({ default: m.MessagesPage })),
);

const PortalsPage = lazy(() => import("@/pages/PortalsPage"));
const DailyLogHubPage = lazy(() => import("@/pages/DailyLogHubPage"));
const CrewHubPage = lazy(() => import("@/pages/CrewHubPage"));

export const router = createBrowserRouter([
  {
    element: <PortalLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: "/bid/:token", element: <BidPortal /> },
      { path: "/estimate/:token", element: <EstimatePortal /> },
      { path: "/invoice/:token", element: <InvoicePortal /> },
    ],
  },
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: "landing", element: <LandingPage /> },
      { path: "privacy", element: <PrivacyPage /> },
      { path: "terms", element: <TermsPage /> },
      { path: "sign-in", element: <SignInPage /> },
      { path: "sign-up", element: <SignUpPage /> },
      { path: "signup", element: <Navigate to="/sign-up" replace /> },
      { path: "features", element: <Navigate to={{ pathname: "/", hash: "features" }} replace /> },
      { path: "pricing", element: <Navigate to={{ pathname: "/", hash: "pricing" }} replace /> },
      { path: "auth/callback", element: <AuthCallbackPage /> },
      { path: "accept-invite", element: <AcceptInvitePage /> },
      { path: "affiliate/setup", element: <AffiliateSetupPage /> },
      {
        path: "employee",
        element: <EmployeeLayout />,
        children: [
          { index: true, element: <Navigate to="/employee/clock" replace /> },
          { path: "clock", element: <EmployeeClockPage /> },
          { path: "hours", element: <EmployeeHoursPage /> },
          { path: "jobs", element: <EmployeeJobsPage /> },
          { path: "daily-logs", element: <EmployeeDailyLogsPage /> },
          { path: "messages", element: <MessagesPage employeePortal /> },
          { path: "profile", element: <EmployeeProfilePage /> },
        ],
      },
      {
        element: <AppLayout />,
        children: [
          { path: "dashboard", element: <DashboardPage /> },
          {
            path: "projects",
            element: (
              <SubscriptionRoute feature="projects">
                <Outlet />
              </SubscriptionRoute>
            ),
            children: [
              { index: true, element: <ProjectsPage /> },
              { path: ":id", element: <ProjectsPage /> },
            ],
          },
          {
            path: "financials",
            element: (
              <SubscriptionRoute feature="bankLink">
                <FinancialsLayout />
              </SubscriptionRoute>
            ),
            children: [
              { index: true, element: <Navigate to="/financials/overview" replace /> },
              { path: "overview", element: <RevenuePage /> },
              { path: "transactions", element: <FinancialsTransactionsPage /> },
              { path: "reports", element: <FinancialsReportsPage /> },
              { path: "invoicing", element: <FinancialsInvoicingPage /> },
            ],
          },
          { path: "revenue", element: <Navigate to="/financials" replace /> },
          { path: "accounting", element: <AccountingPage /> },
          {
            path: "documents/*",
            element: (
              <SubscriptionRoute feature="documentVault">
                <DocumentsPage />
              </SubscriptionRoute>
            ),
          },
          {
            path: "estimates/*",
            element: (
              <SubscriptionRoute feature="estimateBuilder">
                <Navigate to="/financials/invoicing" replace />
              </SubscriptionRoute>
            ),
          },
          {
            path: "portals/*",
            element: (
              <SubscriptionRoute feature="subBidPortal">
                <PortalsPage />
              </SubscriptionRoute>
            ),
          },
          {
            path: "daily-log/*",
            element: (
              <SubscriptionRoute feature="dailyLog">
                <DailyLogHubPage />
              </SubscriptionRoute>
            ),
          },
          {
            path: "payroll/*",
            element: (
              <SubscriptionRoute feature="payroll">
                <PayrollPage />
              </SubscriptionRoute>
            ),
          },
          {
            path: "crew/*",
            element: (
              <SubscriptionRoute feature="crewBuilder">
                <CrewHubPage />
              </SubscriptionRoute>
            ),
          },
          {
            path: "directory/*",
            element: (
              <SubscriptionRoute feature="directory">
                <DirectoryPage />
              </SubscriptionRoute>
            ),
          },
          {
            path: "messaging/*",
            element: (
              <SubscriptionRoute feature="messaging">
                <MessagesPage />
              </SubscriptionRoute>
            ),
          },
          { path: "teams", element: <TeamsPage /> },
          { path: "contractors", element: <Navigate to="/directory" replace /> },
          { path: "messages", element: <Navigate to="/messaging" replace /> },
          { path: "settings/billing", element: <Navigate to="/settings?section=billing" replace /> },
          { path: "settings", element: <SettingsPage /> },
          {
            path: "affiliate",
            element: (
              <AffiliateGuard>
                <AffiliateDashboardPage />
              </AffiliateGuard>
            ),
          },
          { path: "admin", element: <AdminGuard><AdminPage /></AdminGuard> },
          { path: "admin/affiliates", element: <AdminGuard><AffiliatesAdminPage /></AdminGuard> },
          { path: "admin/support", element: <AdminGuard><SupportInboxPage /></AdminGuard> },
        ],
      },
      {
        path: "takeoff/*",
        element: (
          <SubscriptionRoute feature="aiTakeoff">
            <TakeoffPage />
          </SubscriptionRoute>
        ),
      },
      { path: "build-lists", element: <BuildListsPage /> },
      { path: "build-lists/:id", element: <BuildListDetailPage /> },
    ],
  },
]);
