"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { useSupabase } from "@/providers/supabase-provider";
import {
  LayoutDashboard,
  Kanban,
  ImagePlus,
  Globe,
  Lock,
  TrendingUp,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  Hexagon,
  Users,
  Calendar,
  Filter,
  LifeBuoy,
  MessageSquare,
  Grid,
} from "lucide-react";

const iconMap = {
  LayoutDashboard,
  Kanban,
  ImagePlus,
  Globe,
  Lock,
  TrendingUp,
  Settings,
  Users,
  Calendar,
  Filter,
  LifeBuoy,
  MessageSquare,
  Grid,
} as const;

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const { profile } = useSupabase();

  const filteredNavItems = profile?.role === 'client'
    ? NAV_ITEMS.filter(item => !item.adminOnly)
    : NAV_ITEMS;

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:relative z-50 flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
          collapsed ? "w-[72px]" : "w-52",
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-center h-16 border-b border-sidebar-border flex-shrink-0 overflow-hidden transition-all duration-300">
          <Link
            href="/"
            className="flex items-center justify-center overflow-hidden shrink-0"
          >
            {!collapsed ? (
              <img src="/logo.png" alt="Linex Medya" style={{ marginRight: '38px' }} className="h-30 w-auto object-contain shrink-0" />
            ) : (
              /* The White 'L' for collapsed state */
              <div className="h-10 w-10 bg-primary rounded-md flex items-center justify-center text-white font-bold text-xl shrink-0 transition-all">
                L
              </div>
            )}
          </Link>

          {/* Mobile close */}
          <button
            onClick={onMobileClose}
            className="ml-auto lg:hidden text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Menüyü kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {filteredNavItems.map((item) => {
            const Icon = iconMap[item.icon as keyof typeof iconMap];
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-sidebar-primary" />
                )}

                <Icon
                  className={cn(
                    "w-5 h-5 flex-shrink-0 transition-colors",
                    isActive
                      ? "text-sidebar-primary"
                      : "text-muted-foreground group-hover:text-sidebar-foreground"
                  )}
                />

                {!collapsed && (
                  <span className="truncate">{item.title}</span>
                )}

                {/* Tooltip for collapsed state */}
                {collapsed && (
                  <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-popover border border-border text-xs font-medium text-popover-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-lg">
                    {item.title}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div className="hidden lg:flex items-center justify-center p-3 border-t border-sidebar-border">
          <button
            onClick={onToggle}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-all duration-200"
            aria-label={collapsed ? "Kenar çubuğunu genişlet" : "Kenar çubuğunu daralt"}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
