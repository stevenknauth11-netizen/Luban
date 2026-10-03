'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard,
  LayoutGrid,
  Package,
  BookOpen,
  Wrench,
  ClipboardList,
  Shield,
  LogOut,
  Cpu,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Profile } from '@/lib/types';
import { RealtimeListener } from '@/components/features/RealtimeListener';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Panel General', icon: LayoutDashboard },
  { href: '/dashboard/catalog', label: 'Vitrina de Equipos', icon: LayoutGrid },
  { href: '/dashboard/equipment', label: 'Catálogo y Gestión', icon: Package },
  { href: '/dashboard/loans', label: 'Centro de Préstamos', icon: BookOpen },
  { href: '/dashboard/maintenance', label: 'Taller de Mantenimiento', icon: Wrench },
  { href: '/dashboard/logs', label: 'Auditoría y Registros', icon: ClipboardList },
];

const ADMIN_ITEMS = [
  { href: '/admin', label: 'Administración', icon: Shield },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (data) setProfile(data as Profile);
    }
    fetchProfile();
  }, [supabase]);

  // Cerrar drawer móvil al cambiar de ruta
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const allNavItems = [
    ...NAV_ITEMS,
    ...(profile?.role === 'admin' ? ADMIN_ITEMS : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      <RealtimeListener />

      {/* TOPBAR MÓVIL Y TABLET (< lg) */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 h-16 bg-slate-900 text-white px-4 flex items-center justify-between border-b border-white/10 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-white/10 flex items-center justify-center flex-shrink-0">
            <Cpu className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight leading-none">Taller Luban</p>
            <p className="text-[11px] text-white/50 font-mono mt-0.5">INATEC · LIMS</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="p-2 -mr-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors focus:outline-none"
          aria-label="Abrir Menú de Navegación"
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* DRAWER / SLIDE-OVER MÓVIL (< lg) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop con desenfoque suave */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-fadeIn"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Lateral */}
          <aside className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] flex flex-col bg-slate-900 text-white shadow-2xl transform transition-transform animate-slideInLeft">
            {/* Header del Drawer */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Cpu className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold tracking-tight">Taller Luban</p>
                  <p className="text-[11px] text-white/40">Inventariado IoT</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Cerrar Menú"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Enlaces de Navegación en Móvil */}
            <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
              {allNavItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`
                      flex items-center gap-3 px-3.5 py-3 rounded-lg text-sm font-medium
                      transition-colors duration-150
                      ${
                        isActive
                          ? 'bg-white/15 text-white shadow-xs'
                          : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }
                    `}
                  >
                    <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-red-400' : ''}`} />
                    <span className="truncate">{item.label}</span>
                    {isActive && (
                      <ChevronRight className="w-4 h-4 ml-auto text-white/50" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Pie de Usuario en Móvil */}
            <div className="border-t border-white/10 p-4">
              {profile && (
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-xs font-bold text-white uppercase flex-shrink-0">
                    {profile.full_name?.[0] || profile.email[0]}
                  </div>
                  <div className="truncate min-w-0">
                    <p className="text-sm font-medium truncate text-white">
                      {profile.full_name || 'Sin Nombre'}
                    </p>
                    <p className="text-xs text-white/40 truncate">{profile.email}</p>
                  </div>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm text-red-300
                           hover:bg-red-500/10 transition-colors font-medium min-h-[44px]"
              >
                <LogOut className="w-4 h-4" />
                Cerrar Sesión
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* SIDEBAR FIJO ORIGINAL DE ESCRITORIO (>= lg) — ESTRICTAMENTE PRESERVADO */}
      <aside
        className="hidden lg:flex fixed inset-y-0 left-0 z-30 flex-col bg-slate-900 text-white w-[260px]"
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="w-8 h-8 rounded-md bg-white/10 flex items-center justify-center flex-shrink-0">
            <Cpu className="w-5 h-5 text-red-400" />
          </div>
          <div className="truncate">
            <p className="text-sm font-semibold tracking-tight truncate">Taller Luban</p>
            <p className="text-xs text-white/40 truncate">Inventariado IoT</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {allNavItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium
                  transition-colors duration-150
                  ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                  }
                `}
              >
                <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-red-400' : ''}`} />
                <span className="truncate">{item.label}</span>
                {isActive && (
                  <ChevronRight className="w-3.5 h-3.5 ml-auto text-white/40" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/10 px-4 py-4">
          {profile && (
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-xs font-bold text-white uppercase flex-shrink-0">
                {profile.full_name?.[0] || profile.email[0]}
              </div>
              <div className="truncate min-w-0">
                <p className="text-sm font-medium truncate">
                  {profile.full_name || 'Sin Nombre'}
                </p>
                <p className="text-xs text-white/40 truncate">{profile.email}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-white/50
                       hover:bg-white/5 hover:text-white/80 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL: Responsivo con margen superior en móvil y margen izquierdo en Desktop */}
      <main className="flex-1 min-h-screen pt-16 lg:pt-0 lg:ml-[260px] w-full min-w-0">
        <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-6 animate-fadeIn max-w-full overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
