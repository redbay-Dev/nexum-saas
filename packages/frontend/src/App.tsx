import { Routes, Route } from "react-router";
import { ProtectedRoute } from "@frontend/components/protected-route.js";
import { AppShell } from "@frontend/components/app-shell.js";
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

export function App(): React.JSX.Element {
  return (
    <Routes>
      {/* Auth error page (shown when OpShield callback fails) */}
      <Route path="/auth-error" element={<AuthErrorPage />} />

      {/* All other routes are protected — unauthenticated users redirect to OpShield */}
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
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
      </Route>
    </Routes>
  );
}
