import {
  Bell,
  CalendarDays,
  FileText,
  Gauge,
  LayoutDashboard,
  MapPin,
  PackagePlus,
  Route as RouteIcon,
  Sparkles,
  Truck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Role } from "@/data/fleet";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  exact?: boolean;
}

export const roleMeta: Record<Role, { title: string; person: string; initials: string }> = {
  manager: { title: "Fleet Manager", person: "Amit Rao", initials: "AR" },
  driver: { title: "Driver", person: "Rahul Sharma", initials: "RS" },
  client: { title: "Client", person: "Acme Corp.", initials: "AC" },
};

export const navigation: Record<Role, NavItem[]> = {
  manager: [
    { label: "Fleet Report", to: "/manager", icon: Gauge, exact: true },
    { label: "Driver Intelligence", to: "/manager/intelligence", icon: Sparkles },
    { label: "List of Deliveries", to: "/manager/deliveries", icon: Truck },
    { label: "Drivers", to: "/manager/drivers", icon: Users },
    { label: "Trip Reports", to: "/manager/trips", icon: RouteIcon },
  ],
  driver: [
    { label: "My Schedule", to: "/driver/schedule", icon: CalendarDays },
    { label: "My Deliveries", to: "/driver/deliveries", icon: Truck },
    { label: "Document Status", to: "/driver/documents", icon: FileText },
    { label: "My Performance", to: "/driver/performance", icon: Gauge },
    { label: "Notifications", to: "/driver/notifications", icon: Bell },
  ],
  client: [
    { label: "Track", to: "/client", icon: MapPin, exact: true },
    { label: "Create New", to: "/client/create", icon: PackagePlus },
    { label: "Notifications", to: "/client/notifications", icon: Bell },
  ],
};
