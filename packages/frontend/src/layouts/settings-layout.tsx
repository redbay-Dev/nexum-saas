import { Outlet, NavLink } from "react-router";
import { Building2, Users, SlidersHorizontal, FileText, CreditCard, Calculator, BarChart3, Fuel, Copy, Receipt } from "lucide-react";
import { useAuth } from "@frontend/hooks/use-auth.js";
import { cn } from "@frontend/lib/utils.js";
import type { Permission } from "@nexum/shared";

interface SettingsNavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  permission?: Permission;
}

const SETTINGS_ITEMS: SettingsNavItem[] = [
  { to: "/settings/organisation", label: "Organisation", icon: Building2, permission: "view:organisation" },
  { to: "/settings/users", label: "Users", icon: Users, permission: "view:users" },
  { to: "/settings/job-types", label: "Job Types", icon: SlidersHorizontal },
  { to: "/settings/rate-cards", label: "Rate Cards", icon: CreditCard, permission: "view:pricing" },
  { to: "/settings/markup-rules", label: "Markup Rules", icon: Calculator, permission: "view:pricing" },
  { to: "/settings/margin-thresholds", label: "Margin Thresholds", icon: BarChart3, permission: "view:pricing" },
  { to: "/settings/surcharges", label: "Surcharges", icon: Fuel, permission: "view:pricing" },
  { to: "/settings/pricing-templates", label: "Pricing Templates", icon: Copy, permission: "view:pricing" },
  { to: "/settings/invoicing", label: "Invoicing", icon: Receipt, permission: "view:invoicing" },
  { to: "/settings/audit-log", label: "Audit Log", icon: FileText, permission: "view:audit_log" },
];

export function SettingsLayout(): React.JSX.Element {
  const { can } = useAuth();

  const visibleItems = SETTINGS_ITEMS.filter(
    (item) => !item.permission || can(item.permission),
  );

  return (
    <div className="flex gap-8">
      <nav className="w-56 shrink-0">
        <div className="sticky top-4 space-y-1">
          <h2 className="mb-3 px-3 text-lg font-semibold tracking-tight">Settings</h2>
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
