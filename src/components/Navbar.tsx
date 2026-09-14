import React from 'react';
import { SolariLogo } from './SolariLogo';
import { UserRole } from '../types';
import {
  CheckSquare,
  ShoppingCart,
  Boxes,
  Users,
  FileText,
  BarChart3,
  WifiOff,
  Radio,
  ShieldCheck,
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'tasks' | 'pos' | 'stock' | 'customers' | 'sales' | 'reports';
  setActiveTab: (tab: 'tasks' | 'pos' | 'stock' | 'customers' | 'sales' | 'reports') => void;
  currentRole: UserRole;
  currentUserName: string;
  isConnected: boolean;
  terminalsCount: number;
  onOpenTerminals: () => void;
  taskCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentRole,
  currentUserName,
  isConnected,
  terminalsCount,
  onOpenTerminals,
  taskCount,
}) => {
  // Pretty French label for the role badge (handles lowercase DB roles)
  const roleDisplayLabel = (r: string): string => {
    const map: Record<string, string> = {
      admin: 'Administrateur',
      manager: 'Manager',
      cashier: 'Vendeur',
      warehouse: 'Magasinier',
      viewer: 'Auditeur',
    };
    const key = (r || '').toLowerCase();
    return map[key] || r || 'Utilisateur';
  };

  interface NavItem {
    id: 'tasks' | 'pos' | 'stock' | 'customers' | 'sales' | 'reports';
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }

  const navItems: NavItem[] = [
    { id: 'tasks', label: 'Tâches & Dispatch', icon: CheckSquare, badge: taskCount > 0 ? taskCount : undefined },
    { id: 'pos', label: 'Caisse POS', icon: ShoppingCart },
    { id: 'stock', label: 'Stock & Dépôt', icon: Boxes },
    { id: 'customers', label: 'Clients & Créances', icon: Users },
    { id: 'sales', label: 'Factures & Ventes', icon: FileText },
    { id: 'reports', label: 'Rapports & Audit', icon: BarChart3 },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-stone-200 shadow-xs no-print">
      {/* Top Banner / Brand & Sync Status */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          <SolariLogo size="sm" showSubtitle={true} />

          <div className="hidden lg:flex items-center gap-2 pl-4 border-l border-stone-200 text-xs text-stone-500">
            <span className="font-semibold text-stone-700">Dépôt:</span>
            <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md font-mono font-medium">
              MAIN (Main Warehouse)
            </span>
          </div>
        </div>

        {/* Real-time sync pill + Read-only user badge */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live Sync Status Button */}
          <button
            onClick={onOpenTerminals}
            title="Cliquez pour voir les appareils connectés en direct"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
              isConnected
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
            }`}
          >
            {isConnected ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Radio className="w-3.5 h-3.5 text-emerald-600 hidden sm:inline" />
                <span className="truncate max-w-[130px] sm:max-w-none">
                  {terminalsCount} {terminalsCount === 1 ? 'appareil en direct' : 'appareils synchronisés'}
                </span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-rose-500" />
                <span>Reconnexion...</span>
              </>
            )}
          </button>

          {/* Read-only logged-in user badge (role comes from login, not a switcher) */}
          <div className="flex items-center gap-1.5 bg-stone-100 border border-stone-200 px-2.5 py-1 rounded-lg text-xs font-medium text-stone-800">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
            <div className="flex flex-col items-start leading-none">
              <span className="text-[10px] text-stone-500 font-normal uppercase">
                {roleDisplayLabel(currentRole)}
              </span>
              <span className="font-semibold truncate max-w-[90px] sm:max-w-[120px]">
                {currentUserName}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <nav className="border-t border-stone-100 bg-stone-50/70 overflow-x-auto custom-scrollbar">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 flex space-x-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-amber-600 text-amber-900 bg-amber-100/50'
                    : 'border-transparent text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-600' : 'text-stone-400'}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-amber-600 text-white' : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
};