import {
  BarChart3,
  CalendarDays,
  ChefHat,
  Wallet,
  LayoutDashboard,
  Users,
  type LucideIcon,
} from "lucide-react";

export const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  orders: CalendarDays,
  recipe_calculator: ChefHat,
  sales_reports: BarChart3,
  costing_expenses: Wallet,
  users: Users,
};

export type NavTab = { key: string; href: string; label: string };
