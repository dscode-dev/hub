import type { Route } from 'next';
import {
  BarChart3,
  Boxes,
  ClipboardList,
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

export interface NavGroup {
  /** `null` deixa o item solto no topo, sem cabecalho. */
  label: string | null;
  items: NavItem[];
}

/**
 * Navegacao completa desde o inicio: o usuario ve o alcance do produto e nao
 * se assusta quando um modulo novo aparece. O que ainda nao existe leva a uma
 * pagina honesta de "em breve" em vez de sumir do menu.
 *
 * Os grupos seguem a rotina de quem opera a loja, nao a arquitetura do sistema:
 * primeiro o que se cadastra, depois o que se vende, depois o que se controla.
 * Uma lista unica de nove itens obriga a ler tudo para achar qualquer coisa.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ label: 'Visao geral', href: '/dashboard', icon: LayoutDashboard, ready: true }],
  },
  {
    label: 'Catalogo',
    items: [
      { label: 'Produtos', href: '/products', icon: Package, ready: true },
      { label: 'Estoque', href: '/inventory', icon: Boxes, ready: true },
      { label: 'Inventarios', href: '/inventory/counts', icon: ClipboardList, ready: true },
    ],
  },
  {
    label: 'Vendas',
    items: [
      { label: 'Vendas', href: '/sales', icon: ShoppingCart, ready: false },
      { label: 'Clientes', href: '/customers', icon: Users, ready: false },
      { label: 'Entregas', href: '/deliveries', icon: Truck, ready: false },
    ],
  },
  {
    label: 'Gestao',
    items: [
      { label: 'Financeiro', href: '/finance', icon: Receipt, ready: false },
      { label: 'Relatorios', href: '/reports', icon: BarChart3, ready: false },
      { label: 'Configuracoes', href: '/settings', icon: Settings, ready: false },
    ],
  },
];

export function isActiveRoute(pathname: string, href: string): boolean {
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }

  /*
   * "Inventarios" vive sob /inventory, entao marcar o pai por prefixo acenderia
   * os dois ao mesmo tempo. O item mais especifico vence.
   */
  if (href === '/inventory') {
    return pathname === '/inventory';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
