import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Building2,
  FileText,
  ShoppingCart,
  FileCheck,
  Receipt,
  FolderOpen,
  Bell,
  Shield,
  BarChart3,
  Users,
  Settings,
  X,
  Hexagon,
  UserCircle,
  CreditCard,
  ChevronDown,
  ChevronRight,
  ScanSearch,
  Sparkles,
  FileSearch,
  Search,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed?: boolean;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles?: string[];
  children?: NavItem[];
}

const NavItemComponent: React.FC<{ item: NavItem; onClose: () => void; depth?: number; collapsed?: boolean }> = ({ item, onClose, depth = 0, collapsed = false }) => {
  const location = useLocation();
  const [expanded, setExpanded] = useState(() =>
    item.children ? item.children.some(c => location.pathname.startsWith(c.path)) : false
  );
  const isActive = location.pathname === item.path;
  const hasChildren = item.children && item.children.length > 0;

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          title={collapsed ? item.label : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group ${collapsed ? 'justify-center' : ''}
            ${expanded ? 'text-white bg-white/[0.04]' : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'}`}
          style={{ paddingLeft: !collapsed && depth > 0 ? `${depth * 12 + 12}px` : undefined }}
        >
          <span className={`${expanded ? 'text-white' : 'text-neutral-500 group-hover:text-white'} transition-colors shrink-0`}>
            {item.icon}
          </span>
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{item.label}</span>
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </>
          )}
        </button>
        {expanded && !collapsed && (
          <div className="mt-1 space-y-1">
            {item.children!.map((child) => (
              <NavItemComponent key={child.path} item={child} onClose={onClose} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={item.path}
      onClick={onClose}
      title={collapsed ? item.label : undefined}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group ${collapsed ? 'justify-center' : ''}
        ${isActive
          ? 'bg-white text-black'
          : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
        }`}
      style={{ paddingLeft: !collapsed && depth > 0 ? `${depth * 12 + 12}px` : undefined }}
    >
      <span className={`${isActive ? 'text-black' : 'text-neutral-500 group-hover:text-white'} transition-colors shrink-0`}>
        {item.icon}
      </span>
      {!collapsed && item.label}
    </NavLink>
  );
};

const NavGroup: React.FC<{ label: string; children: React.ReactNode; collapsed?: boolean }> = ({ label, children, collapsed }) => (
  <div className="mb-4">
    {collapsed ? (
      <div className="mx-3 mb-2 border-t border-white/[0.06]" />
    ) : (
      <p className="px-3 mb-1 text-[10px] font-semibold tracking-widest text-neutral-600 uppercase">{label}</p>
    )}
    <div className="space-y-0.5">{children}</div>
  </div>
);

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, collapsed = false }) => {
  const { user } = useAuth();
  const role = user?.role || '';

  // ── Procurement Group ────────────────────────────────────────────
  const procurementItems: NavItem[] = [
    { label: 'Vendors', path: '/vendors', icon: <Building2 size={18} />, roles: ['admin', 'procurement_manager', 'auditor'] },
    { label: 'Purchase Requests', path: '/purchase-requests', icon: <FileText size={18} />, roles: ['admin', 'procurement_manager', 'auditor'] },
    { label: 'Purchase Orders', path: '/purchase-orders', icon: <ShoppingCart size={18} />, roles: ['admin', 'procurement_manager', 'finance', 'auditor', 'vendor'] },
    { label: 'Contracts', path: '/contracts', icon: <FileCheck size={18} />, roles: ['admin', 'procurement_manager', 'finance', 'auditor', 'vendor'] },
  ];

  // ── Finance Group ────────────────────────────────────────────────
  const financeItems: NavItem[] = [
    { label: 'Invoice Dashboard', path: '/invoice-dashboard', icon: <Receipt size={18} />, roles: ['admin', 'finance', 'procurement_manager', 'auditor', 'vendor'] },
    { label: 'Customers', path: '/customers', icon: <UserCircle size={18} />, roles: ['admin', 'finance'] },
    { label: 'Payments', path: '/payments', icon: <CreditCard size={18} />, roles: ['admin', 'finance', 'auditor'] },
  ];

  // ── AI Group ─────────────────────────────────────────────────────
  const aiItems: NavItem[] = [
    { label: 'Copilot', path: '/ai', icon: <Sparkles size={18} />, roles: ['admin', 'procurement_manager', 'finance', 'vendor', 'auditor', 'employee'] },
    { label: 'Document Search', path: '/ai/search', icon: <Search size={18} />, roles: ['admin', 'procurement_manager', 'finance', 'vendor', 'auditor', 'employee'] },
    { label: 'Contract Intelligence', path: '/ai/contracts', icon: <FileSearch size={18} />, roles: ['admin', 'procurement_manager', 'finance', 'auditor'] },
    { label: 'Invoice Intelligence', path: '/ai/invoices', icon: <ScanSearch size={18} />, roles: ['admin', 'finance', 'procurement_manager', 'auditor', 'vendor'] },
  ];

  // ── System Group ─────────────────────────────────────────────────
  const systemItems: NavItem[] = [
    { label: 'Documents', path: '/documents', icon: <FolderOpen size={18} />, roles: ['admin', 'procurement_manager', 'finance', 'vendor', 'auditor', 'employee'] },
    { label: 'Notifications', path: '/notifications', icon: <Bell size={18} />, roles: ['admin', 'procurement_manager', 'finance', 'vendor', 'auditor', 'employee'] },
    { label: 'Reports', path: '/reports', icon: <BarChart3 size={18} />, roles: ['admin', 'procurement_manager', 'finance', 'auditor'] },
    { label: 'Audit Logs', path: '/audit-logs', icon: <Shield size={18} />, roles: ['admin', 'auditor'] },
    { label: 'Users', path: '/users', icon: <Users size={18} />, roles: ['admin'] },
    { label: 'Settings', path: '/settings', icon: <Settings size={18} />, roles: ['admin', 'procurement_manager', 'finance', 'vendor', 'auditor', 'employee'] },
  ];

  const filter = (items: NavItem[]) => items.filter(item => !item.roles || item.roles.includes(role));

  const filteredProcurement = filter(procurementItems);
  const filteredFinance = filter(financeItems);
  const filteredAi = filter(aiItems);
  const filteredSystem = filter(systemItems);

  const SidebarContent: React.FC<{ collapsed?: boolean }> = ({ collapsed = false }) => (
    <>
      {/* Logo */}
      <div className={`flex items-center gap-2 h-16 border-b border-white/[0.06] shrink-0 ${collapsed ? 'justify-center px-2' : 'px-6'}`}>
        <Hexagon size={24} className="text-white shrink-0" />
        {!collapsed && <span className="text-lg font-bold tracking-tight">ProcureFlow</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 overflow-y-auto overflow-x-hidden space-y-0">
        {/* Dashboard — always visible */}
        <div className="mb-4 space-y-0.5">
          <NavItemComponent item={{ label: 'Dashboard', path: '/', icon: <LayoutDashboard size={18} /> }} onClose={onClose} collapsed={collapsed} />
        </div>

        {filteredProcurement.length > 0 && (
          <NavGroup label="Procurement" collapsed={collapsed}>
            {filteredProcurement.map(item => <NavItemComponent key={item.path} item={item} onClose={onClose} collapsed={collapsed} />)}
          </NavGroup>
        )}

        {filteredFinance.length > 0 && (
          <NavGroup label="Finance" collapsed={collapsed}>
            {filteredFinance.map(item => <NavItemComponent key={item.path} item={item} onClose={onClose} collapsed={collapsed} />)}
          </NavGroup>
        )}

        {filteredAi.length > 0 && (
          <NavGroup label="AI" collapsed={collapsed}>
            {filteredAi.map(item => <NavItemComponent key={item.path} item={item} onClose={onClose} collapsed={collapsed} />)}
          </NavGroup>
        )}

        {filteredSystem.length > 0 && (
          <NavGroup label="System" collapsed={collapsed}>
            {filteredSystem.map(item => <NavItemComponent key={item.path} item={item} onClose={onClose} collapsed={collapsed} />)}
          </NavGroup>
        )}
      </nav>

      {/* User info */}
      <div className="p-4 border-t border-white/[0.06] shrink-0">
        <div className={`flex items-center gap-3 px-3 py-2 ${collapsed ? 'justify-center px-0' : ''}`} title={collapsed ? `${user?.firstName} ${user?.lastName}` : undefined}>
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white shrink-0">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-neutral-500 truncate capitalize">{user?.role?.replace(/_/g, ' ')}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onClose} />
      )}

      {/* Mobile sidebar — always full width with labels, regardless of desktop collapsed state */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-card border-r border-white/[0.06] z-50 flex flex-col transform transition-transform duration-300 lg:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="absolute top-4 right-4">
          <button onClick={onClose} className="text-neutral-400 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>
        <SidebarContent collapsed={false} />
      </aside>

      {/* Desktop sidebar — collapses to an icon rail */}
      <aside className={`hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:flex-col bg-card border-r border-white/[0.06] transition-[width] duration-300 ${collapsed ? 'lg:w-16' : 'lg:w-64'}`}>
        <SidebarContent collapsed={collapsed} />
      </aside>
    </>
  );
};

export default Sidebar;
