/**
 * CRM-2B — single source of truth for the admin sidebar's navigation
 * list. One data-driven list (not duplicated markup) so a later phase
 * (CRM-2C, CRM-3, ...) turns an item "on" by adding a route, not by
 * hunting through JSX. `path` is present even for not-yet-built areas so
 * the "Coming later" entries render as clearly labeled, disabled — never
 * as fake pages with sample data.
 *
 * CRM-2B navigation-architecture refinement: the flat list is now
 * grouped into sections (Command Center standing alone, then WORKSPACE
 * / ANALYTICS / INTELLIGENCE / ADMINISTRATION) so the full planned CRM
 * is visible and legible today, even though only Command Center has a
 * real route. This file adds no new routes and no new data — every item
 * below Command Center keeps `status: 'comingLater'`.
 */
import type { ComponentType, CSSProperties } from 'react';
import {
  LayoutGrid,
  Users,
  UserCheck,
  MessageCircle,
  BarChart3,
  Repeat2,
  DollarSign,
  PiggyBank,
  Wallet,
  Megaphone,
  Gauge,
  Workflow,
  Bot,
  ShieldCheck,
  Plug,
  Settings,
} from 'lucide-react';

type NavIcon = ComponentType<{ size?: number; strokeWidth?: number; className?: string; style?: CSSProperties }>;

export interface AdminNavItem {
  key: string;
  label: string;
  icon: NavIcon;
  path: string;
  status: 'active' | 'comingLater';
}

export interface AdminNavSection {
  key: string;
  /** null = ungrouped (rendered with no section label — Command Center only). */
  label: string | null;
  items: AdminNavItem[];
}

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    key: 'overview',
    label: null,
    items: [{ key: 'command-center', label: 'Command Center', icon: LayoutGrid, path: '/admin', status: 'active' }],
  },
  {
    key: 'workspace',
    label: 'Workspace',
    items: [
      { key: 'leads', label: 'Leads & Pipeline', icon: Users, path: '/admin/leads', status: 'comingLater' },
      { key: 'customers', label: 'Customers', icon: UserCheck, path: '/admin/customers', status: 'comingLater' },
      { key: 'conversations', label: 'Conversations', icon: MessageCircle, path: '/admin/conversations', status: 'comingLater' },
    ],
  },
  {
    key: 'analytics',
    label: 'Analytics',
    items: [
      { key: 'sales-dashboard', label: 'Sales Dashboard', icon: BarChart3, path: '/admin/sales', status: 'comingLater' },
      { key: 'customer-subscription', label: 'Customer & Subscription', icon: Repeat2, path: '/admin/subscriptions', status: 'comingLater' },
      { key: 'revenue', label: 'Revenue', icon: DollarSign, path: '/admin/revenue', status: 'comingLater' },
      { key: 'finance', label: 'Finance & P&L', icon: PiggyBank, path: '/admin/finance', status: 'comingLater' },
      { key: 'cash-flow', label: 'Cash Flow', icon: Wallet, path: '/admin/cash-flow', status: 'comingLater' },
      { key: 'marketing', label: 'Marketing', icon: Megaphone, path: '/admin/marketing', status: 'comingLater' },
      { key: 'operations-capacity', label: 'Operations & Capacity', icon: Gauge, path: '/admin/operations', status: 'comingLater' },
    ],
  },
  {
    key: 'intelligence',
    label: 'Intelligence',
    items: [
      { key: 'automations', label: 'Automations', icon: Workflow, path: '/admin/automations', status: 'comingLater' },
      { key: 'ai-agents', label: 'AI Agents', icon: Bot, path: '/admin/ai-agents', status: 'comingLater' },
    ],
  },
  {
    key: 'administration',
    label: 'Administration',
    items: [
      { key: 'team', label: 'Team & Access', icon: ShieldCheck, path: '/admin/team', status: 'comingLater' },
      { key: 'integrations', label: 'Integrations', icon: Plug, path: '/admin/integrations', status: 'comingLater' },
      { key: 'settings', label: 'Settings', icon: Settings, path: '/admin/settings', status: 'comingLater' },
    ],
  },
];

/** Flattened view of every item across every section, in display order. */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV_SECTIONS.flatMap((section) => section.items);
