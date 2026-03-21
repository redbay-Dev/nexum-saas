import { Outlet, NavLink, useLocation } from "react-router";
import {
  Briefcase,
  Building2,
  ChevronRight,
  FolderKanban,
  Globe,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  Settings,
  Truck,
  UserRound,
  Users,
} from "lucide-react";
import { signOut } from "@frontend/lib/auth-client.js";
import { useAuth } from "@frontend/hooks/use-auth.js";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@frontend/components/ui/sidebar.js";
import { Separator } from "@frontend/components/ui/separator.js";
import { Avatar, AvatarFallback } from "@frontend/components/ui/avatar.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@frontend/components/ui/dropdown-menu.js";
import { Badge } from "@frontend/components/ui/badge.js";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
}

const CORE_NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
];

const OPERATIONS_NAV: NavItem[] = [
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/companies", label: "Companies", icon: Building2 },
  { to: "/contacts", label: "Contacts", icon: UserRound },
  { to: "/addresses", label: "Addresses", icon: MapPin },
  { to: "/regions", label: "Regions", icon: Globe },
  { to: "/employees", label: "Drivers & Staff", icon: Users },
  { to: "/assets", label: "Assets", icon: Truck },
  { to: "/materials", label: "Materials", icon: Package },
];

const BREADCRUMB_MAP: Record<string, string> = {
  "/": "Dashboard",
  "/jobs": "Jobs",
  "/jobs/new": "New Job",
  "/projects": "Projects",
  "/projects/new": "New Project",
  "/companies": "Companies",
  "/companies/new": "Add Company",
  "/contacts": "Contacts",
  "/contacts/new": "Add Contact",
  "/addresses": "Addresses",
  "/addresses/new": "Add Address",
  "/regions": "Regions",
  "/regions/new": "Add Region",
  "/employees": "Drivers & Staff",
  "/employees/new": "Add Employee",
  "/assets": "Assets",
  "/assets/new": "Add Asset",
  "/materials": "Materials",
  "/materials/new": "Add Material",
};

function getInitials(email: string): string {
  return (email.split("@")[0] ?? "").slice(0, 2).toUpperCase();
}

function NavSection({ label, items }: { label: string; items: NavItem[] }): React.JSX.Element {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.to}>
              {item.disabled ? (
                <SidebarMenuButton disabled>
                  <item.icon />
                  <span>{item.label}</span>
                  <Badge variant="secondary" className="ml-auto text-[10px] px-1.5">
                    Soon
                  </Badge>
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton asChild>
                  <NavLink to={item.to} end={item.to === "/"}>
                    <item.icon />
                    <span>{item.label}</span>
                    <ChevronRight className="ml-auto opacity-0 group-data-[active]/menu-button:opacity-100 transition-opacity" />
                  </NavLink>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppShell(): React.JSX.Element {
  const { auth } = useAuth();
  const location = useLocation();

  const pageTitle =
    BREADCRUMB_MAP[location.pathname] ??
    (location.pathname.startsWith("/jobs/")
      ? "Job Detail"
      : location.pathname.startsWith("/projects/")
        ? "Project Detail"
        : location.pathname.startsWith("/companies/")
          ? "Company Detail"
          : location.pathname.startsWith("/contacts/")
            ? "Contact Detail"
            : location.pathname.startsWith("/addresses/")
              ? "Address Detail"
              : location.pathname.startsWith("/regions/")
                ? "Region Detail"
                : location.pathname.startsWith("/employees/")
                  ? "Employee Detail"
                  : location.pathname.startsWith("/assets/")
                    ? "Asset Detail"
                    : location.pathname.startsWith("/materials/")
                      ? "Material Detail"
                      : "Nexum");

  async function handleSignOut(): Promise<void> {
    // signOut() clears the local cookie and redirects to OpShield login
    await signOut();
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Truck className="h-4.5 w-4.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-none">Nexum</span>
              <span className="mt-0.5 text-[11px] leading-tight text-sidebar-foreground/60">
                Transport &amp; Logistics
              </span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <NavSection label="Overview" items={CORE_NAV} />
          <NavSection label="Operations" items={OPERATIONS_NAV} />
        </SidebarContent>

        <SidebarFooter className="p-3">
          {auth ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left text-sm hover:bg-sidebar-accent transition-colors outline-none">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-sidebar-primary/20 text-xs font-medium text-sidebar-primary">
                    {getInitials(auth.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate text-xs font-medium">{auth.email}</span>
                  <span className="truncate text-[11px] capitalize text-sidebar-foreground/60">
                    {auth.role}
                  </span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void handleSignOut()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <h1 className="text-sm font-medium">{pageTitle}</h1>
        </header>
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
