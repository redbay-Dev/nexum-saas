import { Routes, Route, Navigate } from "react-router";
import { ProtectedRoute } from "@frontend/components/protected-route.js";
import { AppShell } from "@frontend/components/app-shell.js";
import { LoginPage } from "@frontend/pages/login.js";
import { AuthErrorPage } from "@frontend/pages/auth-error.js";
import { DashboardPage } from "@frontend/pages/dashboard.js";
import { CompaniesPage } from "@frontend/pages/companies/index.js";
import { CreateCompanyPage } from "@frontend/pages/companies/create.js";
import { CompanyDetailPage } from "@frontend/pages/companies/detail.js";
import { ContactsPage } from "@frontend/pages/contacts/index.js";
import { CreateContactPage } from "@frontend/pages/contacts/create.js";
import { ContactDetailPage } from "@frontend/pages/contacts/detail.js";
import { AddressesPage } from "@frontend/pages/addresses/index.js";
import { CreateAddressPage } from "@frontend/pages/addresses/create.js";
import { AddressDetailPage } from "@frontend/pages/addresses/detail.js";
import { RegionsPage } from "@frontend/pages/regions/index.js";
import { CreateRegionPage } from "@frontend/pages/regions/create.js";
import { RegionDetailPage } from "@frontend/pages/regions/detail.js";
import { EmployeesPage } from "@frontend/pages/employees/index.js";
import { CreateEmployeePage } from "@frontend/pages/employees/create.js";
import { EmployeeDetailPage } from "@frontend/pages/employees/detail.js";
import { AssetsPage } from "@frontend/pages/assets/index.js";
import { CreateAssetPage } from "@frontend/pages/assets/create.js";
import { AssetDetailPage } from "@frontend/pages/assets/detail.js";
import { MaterialsPage } from "@frontend/pages/materials/index.js";
import { CreateMaterialPage } from "@frontend/pages/materials/create.js";
import { MaterialDetailPage } from "@frontend/pages/materials/detail.js";
import { JobsPage } from "@frontend/pages/jobs/index.js";
import { CreateJobPage } from "@frontend/pages/jobs/create.js";
import { JobDetailPage } from "@frontend/pages/jobs/detail.js";
import { ProjectsPage } from "@frontend/pages/projects/index.js";
import { CreateProjectPage } from "@frontend/pages/projects/create.js";
import { ProjectDetailPage } from "@frontend/pages/projects/detail.js";
import { JobTypeSettingsPage } from "@frontend/pages/settings/job-types.js";
import { OrganisationSettingsPage } from "@frontend/pages/settings/organisation.js";
import { UserManagementPage } from "@frontend/pages/settings/users.js";
import { AuditLogPage } from "@frontend/pages/settings/audit-log.js";
import { SettingsLayout } from "@frontend/layouts/settings-layout.js";
import { SchedulingPage } from "@frontend/pages/scheduling/index.js";
import { RateCardsSettingsPage } from "@frontend/pages/settings/rate-cards.js";
import { RateCardDetailPage } from "@frontend/pages/settings/rate-card-detail.js";
import { MarkupRulesSettingsPage } from "@frontend/pages/settings/markup-rules.js";
import { MarginThresholdsSettingsPage } from "@frontend/pages/settings/margin-thresholds.js";
import { SurchargesSettingsPage } from "@frontend/pages/settings/surcharges.js";
import { PricingTemplatesSettingsPage } from "@frontend/pages/settings/pricing-templates.js";
import { DaysheetsPage } from "@frontend/pages/daysheets/index.js";
import { CreateDaysheetPage } from "@frontend/pages/daysheets/create.js";
import { DaysheetDetailPage } from "@frontend/pages/daysheets/detail.js";
import { InvoicesPage } from "@frontend/pages/invoices/index.js";
import { CreateInvoicePage } from "@frontend/pages/invoices/create.js";
import { InvoiceDetailPage } from "@frontend/pages/invoices/detail.js";
import { ArApprovalsPage } from "@frontend/pages/ar-approvals/index.js";
import { RctisPage } from "@frontend/pages/rctis/index.js";
import { RctiDetailPage } from "@frontend/pages/rctis/detail.js";
import { GenerateRctiPage } from "@frontend/pages/rctis/generate.js";
import { CreditDashboardPage } from "@frontend/pages/credit/index.js";
import { InvoicingSettingsPage } from "@frontend/pages/settings/invoicing.js";
import { DocumentsPage } from "@frontend/pages/documents/index.js";
import { BillingRunsPage } from "@frontend/pages/billing-runs/index.js";
import { BillingRunDetailPage } from "@frontend/pages/billing-runs/detail.js";
import { XeroSettingsPage } from "@frontend/pages/settings/xero.js";
import { NotificationSettingsPage } from "@frontend/pages/settings/notifications.js";

export function App(): React.JSX.Element {
  return (
    <Routes>
      {/* Login — redirects to OpShield for SSO, shows errors on callback failure */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth-error" element={<AuthErrorPage />} />

      {/* All other routes are protected — unauthenticated users redirect to /login */}
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="companies" element={<CompaniesPage />} />
        <Route path="companies/new" element={<CreateCompanyPage />} />
        <Route path="companies/:id" element={<CompanyDetailPage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="contacts/new" element={<CreateContactPage />} />
        <Route path="contacts/:id" element={<ContactDetailPage />} />
        <Route path="addresses" element={<AddressesPage />} />
        <Route path="addresses/new" element={<CreateAddressPage />} />
        <Route path="addresses/:id" element={<AddressDetailPage />} />
        <Route path="regions" element={<RegionsPage />} />
        <Route path="regions/new" element={<CreateRegionPage />} />
        <Route path="regions/:id" element={<RegionDetailPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="employees/new" element={<CreateEmployeePage />} />
        <Route path="employees/:id" element={<EmployeeDetailPage />} />
        <Route path="assets" element={<AssetsPage />} />
        <Route path="assets/new" element={<CreateAssetPage />} />
        <Route path="assets/:id" element={<AssetDetailPage />} />
        <Route path="materials" element={<MaterialsPage />} />
        <Route path="materials/new" element={<CreateMaterialPage />} />
        <Route path="materials/:sourceType/:id" element={<MaterialDetailPage />} />
        <Route path="scheduling" element={<SchedulingPage />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="jobs/new" element={<CreateJobPage />} />
        <Route path="jobs/:id" element={<JobDetailPage />} />
        <Route path="daysheets" element={<DaysheetsPage />} />
        <Route path="daysheets/new" element={<CreateDaysheetPage />} />
        <Route path="daysheets/:id" element={<DaysheetDetailPage />} />
        <Route path="ar-approvals" element={<ArApprovalsPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="invoices/new" element={<CreateInvoicePage />} />
        <Route path="invoices/:id" element={<InvoiceDetailPage />} />
        <Route path="rctis" element={<RctisPage />} />
        <Route path="rctis/generate" element={<GenerateRctiPage />} />
        <Route path="rctis/:id" element={<RctiDetailPage />} />
        <Route path="credit" element={<CreditDashboardPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="billing-runs" element={<BillingRunsPage />} />
        <Route path="billing-runs/:id" element={<BillingRunDetailPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/new" element={<CreateProjectPage />} />
        <Route path="projects/:id" element={<ProjectDetailPage />} />
        <Route path="settings" element={<SettingsLayout />}>
          <Route index element={<Navigate to="/settings/organisation" replace />} />
          <Route path="organisation" element={<OrganisationSettingsPage />} />
          <Route path="users" element={<UserManagementPage />} />
          <Route path="job-types" element={<JobTypeSettingsPage />} />
          <Route path="audit-log" element={<AuditLogPage />} />
          <Route path="rate-cards" element={<RateCardsSettingsPage />} />
          <Route path="rate-cards/:id" element={<RateCardDetailPage />} />
          <Route path="markup-rules" element={<MarkupRulesSettingsPage />} />
          <Route path="margin-thresholds" element={<MarginThresholdsSettingsPage />} />
          <Route path="surcharges" element={<SurchargesSettingsPage />} />
          <Route path="pricing-templates" element={<PricingTemplatesSettingsPage />} />
          <Route path="pricing-templates/:id" element={<PricingTemplatesSettingsPage />} />
          <Route path="invoicing" element={<InvoicingSettingsPage />} />
          <Route path="xero" element={<XeroSettingsPage />} />
          <Route path="notifications" element={<NotificationSettingsPage />} />
        </Route>
      </Route>

      {/* Default redirect */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
