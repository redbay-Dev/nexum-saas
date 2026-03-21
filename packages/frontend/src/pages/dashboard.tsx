import { Link } from "react-router";
import {
  Building2,
  Truck,
  Users,
  Briefcase,
  Plus,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@frontend/hooks/use-auth.js";
import { useCompanies } from "@frontend/api/companies.js";
import { useJobs } from "@frontend/api/jobs.js";
import { useEmployees } from "@frontend/api/employees.js";
import { useAssets } from "@frontend/api/assets.js";
import { Button } from "@frontend/components/ui/button.js";

interface StatCardProps {
  label: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
  href?: string;
}

function StatCard({ label, value, subtitle, icon, iconBg, href }: StatCardProps): React.JSX.Element {
  const card = (
    <div className={`rounded-xl border bg-card p-6 shadow-sm ${href ? "transition-shadow hover:shadow-md" : ""}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
          {icon}
        </div>
      </div>
      <div className="mt-3">
        <p className="text-3xl font-bold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );

  return href ? <Link to={href}>{card}</Link> : card;
}

export function DashboardPage(): React.JSX.Element {
  const { auth, can } = useAuth();
  const { data: companiesData } = useCompanies({ limit: 1 });
  const { data: jobsData } = useJobs({ limit: 1 });
  const { data: employeesData } = useEmployees({ limit: 1 });
  const { data: assetsData } = useAssets({ limit: 1 });

  const companyCount = companiesData?.total ?? 0;
  const jobCount = jobsData?.total ?? 0;
  const employeeCount = employeesData?.total ?? 0;
  const assetCount = assetsData?.total ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {auth ? "Here's your operations overview." : "Welcome back."}
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Companies"
          value={String(companyCount)}
          subtitle="Customers, contractors, suppliers"
          icon={<Building2 className="h-5 w-5 text-blue-600" />}
          iconBg="bg-blue-100/80"
          href="/companies"
        />
        <StatCard
          label="Jobs"
          value={String(jobCount)}
          subtitle="All jobs across statuses"
          icon={<Briefcase className="h-5 w-5 text-emerald-600" />}
          iconBg="bg-emerald-100/80"
          href="/jobs"
        />
        <StatCard
          label="Employees"
          value={String(employeeCount)}
          subtitle="Drivers and staff"
          icon={<Users className="h-5 w-5 text-amber-600" />}
          iconBg="bg-amber-100/80"
          href="/employees"
        />
        <StatCard
          label="Assets"
          value={String(assetCount)}
          subtitle="Vehicles and equipment"
          icon={<Truck className="h-5 w-5 text-violet-600" />}
          iconBg="bg-violet-100/80"
          href="/assets"
        />
      </div>

      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Quick Actions
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {can("manage:jobs") ? (
            <Button variant="outline" className="h-auto justify-start px-5 py-4" asChild>
              <Link to="/jobs/new">
                <Plus className="mr-3 h-4 w-4 text-emerald-600" />
                <div className="flex flex-col items-start text-left">
                  <span className="text-sm font-medium">Create job</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    New transport, disposal, or hire job
                  </span>
                </div>
              </Link>
            </Button>
          ) : null}
          {can("manage:companies") ? (
            <Button variant="outline" className="h-auto justify-start px-5 py-4" asChild>
              <Link to="/companies/new">
                <Plus className="mr-3 h-4 w-4 text-blue-600" />
                <div className="flex flex-col items-start text-left">
                  <span className="text-sm font-medium">Add company</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    Customer, contractor, or supplier
                  </span>
                </div>
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" className="h-auto justify-start px-5 py-4" asChild>
            <Link to="/jobs">
              <ArrowRight className="mr-3 h-4 w-4 text-emerald-600" />
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-medium">View jobs</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Browse and manage all jobs
                </span>
              </div>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
