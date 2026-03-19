import { Routes, Route } from "react-router";
import { ProtectedRoute } from "@frontend/components/protected-route.js";
import { AppShell } from "@frontend/components/app-shell.js";
import { LoginPage } from "@frontend/pages/login.js";
import { RegisterPage } from "@frontend/pages/register.js";
import { OnboardPage } from "@frontend/pages/onboard.js";
import { DashboardPage } from "@frontend/pages/dashboard.js";
import { CompaniesPage } from "@frontend/pages/companies/index.js";
import { CreateCompanyPage } from "@frontend/pages/companies/create.js";
import { CompanyDetailPage } from "@frontend/pages/companies/detail.js";

export function App(): React.JSX.Element {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/onboard" element={<OnboardPage />} />

      {/* Protected routes with app shell */}
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
      </Route>
    </Routes>
  );
}
