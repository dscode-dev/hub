import type { Route } from 'next';
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: Route;
  icon: LucideIcon;
  /** Modulos ainda nao implementados aparecem, mas sinalizados. */
  ready: boolean;
}

/**
 * Navegacao completa desde o inicio: o usuario ve o alcance do produto e nao
 * se assusta quando um modulo novo aparece. O que ainda nao existe leva a uma
 * pagina honesta de "em breve" em vez de sumir do menu.
 */
export const MAIN_NAV: NavItem[] = [
  { label: 'Visao geral', href: '/dashboard', icon: LayoutDashboard, ready: true },
  { label: 'Produtos', href: '/products', icon: Package, ready: true },
  { label: 'Estoque', href: '/inventory', icon: Boxes, ready: false },
  { label: 'Clientes', href: '/customers', icon: Users, ready: false },
  { label: 'Vendas', href: '/sales', icon: ShoppingCart, ready: false },
  { label: 'Financeiro', href: '/finance', icon: Receipt, ready: false },
  { label: 'Entregas', href: '/deliveries', icon: Truck, ready: false },
  { label: 'Relatorios', href: '/reports', icon: BarChart3, ready: false },
  { label: 'Configuracoes', href: '/settings', icon: Settings, ready: false },
];

export function isActiveRoute(pathname: string, href: string): boolean {
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
