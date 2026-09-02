/**
 * CRM-2B — single source of truth for the admin sidebar's navigation
 * list. One data-driven list (not duplicated markup) so a later phase
 * (CRM-2C, CRM-3, ...) turns an item "on" by adding a route, not by
 * hunting through JSX. `path` is present even for not-yet-built areas so
 * the "Coming later" entries render as clearly labeled, disabled — never
 * as fake pages with sample data.
 */
import type { ComponentType, CSSProperties } from 'react';
import {
  LayoutGrid,
  Users,
  UserCheck,
  MessageCircle,
  PiggyBank,
  Megaphone,
  Workflow,
  Bot,
  ShieldCheck,
  Plug,
} from 'lucide-react';

export interface AdminNavItem {
  key: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string; style?: CSSProperties }>;
  path: string;
  status: 'active' | 'comingLater';
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { key: 'command-center', label: 'Command Center', icon: LayoutGrid, path: '/admin', status: 'active' },
  { key: 'leads', label: 'Leads & Pipeline', icon: Users, path: '/admin/leads', status: 'comingLater' },
  { key: 'customers', label: 'Customers', icon: UserCheck, path: '/admin/customers', status: 'comingLater' },
  { key: 'conversations', label: 'Conversations', icon: MessageCircle, path: '/admin/conversations', status: 'comingLater' },
  { key: 'finance', label: 'Finance & P&L', icon: PiggyBank, path: '/admin/finance', status: 'comingLater' },
  { key: 'marketing', label: 'Marketing', icon: Megaphone, path: '/admin/marketing', status: 'comingLater' },
  { key: 'automations', label: 'Automations', icon: Workflow, path: '/admin/automations', status: 'comingLater' },
  { key: 'ai-agents', label: 'AI Agents', icon: Bot, path: '/admin/ai-agents', status: 'comingLater' },
  { key: 'team', label: 'Team & Access', icon: ShieldCheck, path: '/admin/team', status: 'comingLater' },
  { key: 'integrations', label: 'Integrations', icon: Plug, path: '/admin/integrations', status: 'comingLater' },
];
