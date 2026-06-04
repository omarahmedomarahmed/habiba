'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, Users, Shield, Brain, CreditCard,
  Store, Settings, LogOut, Activity, AlertTriangle, ChevronRight,
  Zap, BarChart2, UserCheck, Target, Layers
} from 'lucide-react';
import { useAdminAuth } from '@/lib/store';
import { cn } from '@/lib/utils';

const NAV = [
  {
    section: 'PLATFORM',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/organizations', label: 'Organizations', icon: Building2 },
      { href: '/practice-management', label: 'Practice Mgmt', icon: Layers },
      { href: '/users', label: 'All Users', icon: Users },
      { href: '/therapists', label: 'Therapists', icon: UserCheck },
    ],
  },
  {
    section: 'COMPLIANCE & SAFETY',
    items: [
      { href: '/compliance', label: 'Compliance & Audit', icon: Shield },
      { href: '/ai-governance', label: 'AI Governance', icon: Brain },
    ],
  },
  {
    section: 'BUSINESS',
    items: [
      { href: '/billing', label: 'Billing & Revenue', icon: CreditCard },
      { href: '/marketplace', label: 'Marketplace', icon: Store },
      { href: '/analytics', label: 'Analytics', icon: BarChart2 },
      { href: '/crm', label: 'CRM & Sales', icon: Target },
    ],
  },
  {
    section: 'SYSTEM',
    items: [
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAdminAuth();

  return (
    <aside className="w-64 bg-gray-950 text-white flex flex-col h-screen fixed left-0 top-0 border-r border-gray-800">
      {/* Logo */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm text-white">24Therapy</div>
            <div className="text-xs text-red-400 font-semibold tracking-wider">SUPER ADMIN</div>
          </div>
        </div>
      </div>

      {/* Platform Status */}
      <div className="mx-4 mt-4 px-3 py-2 rounded-lg bg-green-900/30 border border-green-700/40 flex items-center gap-2">
        <Activity className="w-3.5 h-3.5 text-green-400" />
        <span className="text-xs text-green-300 font-medium">All Systems Operational</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {NAV.map((group) => (
          <div key={group.section}>
            <div className="text-[10px] font-semibold text-gray-500 tracking-widest uppercase mb-2 px-2">
              {group.section}
            </div>
            <ul className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/');
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                        active
                          ? 'bg-gradient-to-r from-red-600/30 to-orange-600/20 text-white border border-red-500/30'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                      )}
                    >
                      <Icon className={cn('w-4 h-4', active ? 'text-red-400' : '')} />
                      <span className="flex-1">{label}</span>
                      {active && <ChevronRight className="w-3.5 h-3.5 text-red-400" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* HIPAA Badge */}
      <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-blue-900/20 border border-blue-700/30">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs text-blue-300 font-medium">HIPAA Compliant</span>
        </div>
        <p className="text-[10px] text-gray-500 mt-0.5">SOC 2 Type II • HITECH • GDPR</p>
      </div>

      {/* User */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-xs font-bold">
            {user?.name?.charAt(0) || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name || 'Admin'}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email || 'admin@24therapy.com'}</p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-md hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
