/**
 * Registry of application modules. To add a module: add an entry here, add a matching row
 * to the `modules` table (see supabase/module-permissions.sql), and guard its page,
 * actions and API routes with requireModule / requireApiModule / getUserForModule.
 * New modules are inaccessible to staff until an owner grants them.
 */
export const MODULES = [
  { key: "dashboard", name: "Dashboard", href: "/admin" },
  { key: "orders", name: "Orders", href: "/admin/orders" },
  { key: "recipe_calculator", name: "Recipes", href: "/admin/recipe-calculator" },
  { key: "sales_reports", name: "Reports", href: "/admin/reports" },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];

export const MODULE_KEYS: readonly string[] = MODULES.map((m) => m.key);

/** User Management is not a grantable module: it is exclusive to owners. */
export const USER_MANAGEMENT_HREF = "/admin/users";
