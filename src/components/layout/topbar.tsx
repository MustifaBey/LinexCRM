"use client";

import { useUser } from "@/hooks/use-user";
import { signOut } from "@/actions/auth";
import { getSearchData } from "@/actions/projects";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useRealtime } from "@/hooks/use-realtime";
import { getNotifications, markAsRead, markAllAsRead } from "@/actions/notifications";
import type { Notification } from "@/types/database";
import {
  Bell,
  Menu,
  LogOut,
  Search,
  User,
  ChevronDown,
  Folder,
  Building,
  Key,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";

interface TopbarProps {
  onMenuClick: () => void;
  sidebarCollapsed: boolean;
  userProfile: {
    full_name: string | null;
    avatar_url: string | null;
    email: string | null;
    role: string | null;
    sound_volume?: number | null;
  } | null;
}

export function Topbar({ onMenuClick, userProfile }: TopbarProps) {
  const { user } = useUser();
  const router = useRouter();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      console.log("LOGOUT INITIATED");
      const supabase = createSupabaseClient();
      await supabase.auth.signOut();

      // Nuke local storage to clear any lingering client states
      if (typeof window !== "undefined") {
        localStorage.clear();
        sessionStorage.clear();
      }

      toast.success("Başarıyla çıkış yapıldı.");
      router.replace('/login');
    } catch (error) {
      console.error("Logout failed:", error);
      router.replace('/login');
    }
  };
  const menuRef = useRef<HTMLDivElement>(null);

  // Notifications States
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch initial notifications
  useEffect(() => {
    if (user?.id) {
      getNotifications().then((res) => {
        if (res.data) setNotifications(res.data as Notification[]);
      });
    }
  }, [user]);

  // Realtime notifications listener
  useRealtime<Notification>({
    table: "notifications",
    filterColumn: "user_id",
    filterValue: user?.id,
    onInsert: (newNotif) => {
      setNotifications((prev) => [newNotif, ...prev]);
      
      // Play a custom OGG Audio sound
      try {
        const pool = [
          "/notify1.ogg",
          "/notify2.ogg",
          "/notify3.ogg",
          "/notify4.ogg",
          "/notify5.ogg",
          "/notify6.ogg",
          "/notify7.ogg",
          "/notify8.ogg",
          "/notify9.ogg"
        ];
        const randomSound = pool[Math.floor(Math.random() * pool.length)];
        const audio = new Audio(randomSound);
        const soundVolume = userProfile?.sound_volume ?? 75;
        audio.volume = soundVolume / 100;
        audio.play().catch((e) => console.warn("Audio play failed:", e));
      } catch (audioErr) {
        console.warn("Audio playback error:", audioErr);
      }
    },
    onUpdate: (updatedNotif) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === updatedNotif.id ? updatedNotif : n))
      );
    },
    onDelete: (deletedNotif) => {
      if (!deletedNotif.id) return;
      setNotifications((prev) => prev.filter((n) => n.id !== deletedNotif.id));
    },
    enabled: !!user?.id,
  });

  // Close notifications dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target as Node)) {
        setNotifDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasUnread = notifications.some((n) => !n.is_read);

  const handleMarkAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    await markAsRead(id);
  };

  const handleMarkAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await markAllAsRead();
  };

  // Search Palette States
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchData, setSearchData] = useState<{ projects: any[]; clients: any[]; vault: any[] }>({
    projects: [],
    clients: [],
    vault: [],
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close user menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Listen for Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Load search data when modal opens
  useEffect(() => {
    if (searchOpen) {
      async function loadSearchData() {
        try {
          const data = await getSearchData();
          setSearchData(data);
        } catch (err) {
          console.error("Arama verileri yüklenirken hata:", err);
        }
      }
      loadSearchData();
      // Auto-focus search input
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery("");
      setActiveIndex(0);
    }
  }, [searchOpen]);

  // Filter items based on search query
  const getFilteredItems = () => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      return [
        ...searchData.projects.slice(0, 3).map((p) => ({ ...p, type: "project" })),
        ...searchData.clients.slice(0, 3).map((c) => ({ ...c, type: "client" })),
        ...searchData.vault.slice(0, 3).map((v) => ({ ...v, type: "vault" })),
      ];
    }

    const filteredProjects = searchData.projects
      .filter((p) => p.name.toLowerCase().includes(q))
      .map((p) => ({ ...p, type: "project" }));

    const filteredClients = searchData.clients
      .filter((c) => c.name.toLowerCase().includes(q))
      .map((c) => ({ ...c, type: "client" }));

    const filteredVault = searchData.vault
      .filter((v) => v.label.toLowerCase().includes(q))
      .map((v) => ({ ...v, type: "vault" }));

    return [...filteredProjects, ...filteredClients, ...filteredVault];
  };

  const filteredItems = getFilteredItems();

  // Keyboard navigation inside Command Palette
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[activeIndex]) {
        handleSelectItem(filteredItems[activeIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setSearchOpen(false);
    }
  };

  const handleSelectItem = (item: any) => {
    setSearchOpen(false);
    if (item.type === "project") {
      router.push(`/projects/${item.id}`);
    } else if (item.type === "client") {
      router.push(`/projects`);
    } else if (item.type === "vault") {
      router.push(`/vault?search=${encodeURIComponent(item.label)}`);
    }
  };

  return (
    <>
      <header 
        className="flex items-center h-16 pl-4 pr-4 md:pr-[140px] lg:pl-6 lg:pr-[140px] border-b border-border bg-background/80 backdrop-blur-sm flex-shrink-0 gap-3 md:gap-4 relative z-50 select-none"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          aria-label="Menüyü aç"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search bar trigger */}
        <div className="flex-1 max-w-full md:max-w-md" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          <div
            onClick={() => setSearchOpen(true)}
            className="relative cursor-pointer group"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            <div className="w-full h-9 pl-9 pr-4 rounded-xl bg-muted/50 border border-transparent text-sm text-muted-foreground flex items-center justify-between hover:bg-muted hover:border-border transition-all duration-200">
              <span>Arama yapın...</span>
              <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border border-sidebar-border bg-card px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span className="text-xs">Ctrl</span>K
              </kbd>
            </div>
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-3 md:gap-4 ml-auto" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          {/* Notifications bell */}
          <div className="relative" ref={notifDropdownRef} style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            <button
              onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
              className={cn(
                "relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors [style='-webkit-app-region:no-drag']",
                notifDropdownOpen && "bg-muted text-foreground"
              )}
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              aria-label="Bildirimler"
            >
              <Bell className="w-5 h-5" />
              {hasUnread && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-burgundy animate-pulse" />
              )}
            </button>

            {/* Dropdown */}
            {notifDropdownOpen && (
              <div 
                className="absolute right-0 top-full mt-2 w-80 rounded-xl bg-popover border border-border shadow-xl z-50 animate-in fade-in duration-100 flex flex-col overflow-hidden [style='-webkit-app-region:no-drag']"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/80 bg-muted/20">
                  <span className="text-sm font-semibold text-foreground">Bildirimler</span>
                  {hasUnread && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-[10px] font-semibold text-burgundy hover:opacity-85 transition-opacity"
                    >
                      Tümünü Oku
                    </button>
                  )}
                </div>

                {/* Notifications List */}
                <div className="max-h-72 overflow-y-auto divide-y divide-border/50">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      Bildiriminiz bulunmuyor.
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => {
                          handleMarkAsRead(notif.id);
                          if (notif.action_url) {
                            router.push(notif.action_url);
                          }
                          setNotifDropdownOpen(false);
                        }}
                        className={cn(
                          "p-3 text-left hover:bg-muted/40 transition-colors cursor-pointer flex gap-2.5 items-start",
                          !notif.is_read && "bg-burgundy/5"
                        )}
                      >
                        {/* Status Dot */}
                        {!notif.is_read && (
                          <div className="w-1.5 h-1.5 rounded-full bg-burgundy mt-1.5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <p className={cn("text-xs text-foreground truncate", !notif.is_read ? "font-semibold" : "font-medium")}>
                            {notif.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                            {notif.message}
                          </p>
                          <p className="text-[9px] text-muted-foreground/60 pt-0.5">
                            {new Date(notif.created_at).toLocaleDateString("tr-TR", {
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties} className="app-no-drag">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 hover:bg-muted/50 p-1.5 pr-3 rounded-full transition-colors outline-none app-no-drag [style='-webkit-app-region:no-drag']"
                  style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                  data-app-region="no-drag"
                >
                  {userProfile?.avatar_url ? (
                    <img src={userProfile.avatar_url} alt="Profile" className="w-8 h-8 rounded-full object-cover border border-border/50" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary uppercase">
                      {userProfile?.full_name?.charAt(0) || 'U'}
                    </div>
                  )}
                  <span className="text-sm font-medium hidden md:block">
                    {userProfile?.full_name || 'Kullanıcı'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground ml-1" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuPortal>
                <DropdownMenuContent
                  align="end"
                  className="w-52 rounded-xl bg-popover border border-border shadow-xl py-1.5 z-50 app-no-drag [style='-webkit-app-region:no-drag']"
                  style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                  data-app-region="no-drag"
                >
                  <div className="px-3 py-2 border-b border-border mb-1 app-no-drag" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties} data-app-region="no-drag">
                    <p className="text-sm font-medium text-foreground truncate">
                      {userProfile?.full_name || "Kullanıcı"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate font-normal">
                      {userProfile?.email}
                    </p>
                  </div>

                  <DropdownMenuItem
                    onSelect={() => router.push("/settings")}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground/80 hover:bg-muted hover:text-foreground transition-colors cursor-pointer app-no-drag [style='-webkit-app-region:no-drag']"
                    style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                    data-app-region="no-drag"
                  >
                    <User className="w-4 h-4" />
                    Profil
                  </DropdownMenuItem>

                  <div className="border-t border-border my-1" />

                  <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} className="px-1 pb-1">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        localStorage.clear();
                        sessionStorage.clear();
                        window.location.replace('/login');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors rounded-lg cursor-pointer"
                      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                    >
                      <LogOut className="w-4 h-4" />
                      Çıkış Yap
                    </button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenuPortal>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Command Palette Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] p-4 animate-in fade-in duration-150">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={() => setSearchOpen(false)}
          />

          <div className="relative w-full max-w-xl rounded-2xl bg-card border border-border/80 shadow-2xl overflow-hidden flex flex-col max-h-[50vh] animate-in zoom-in-95 duration-150 z-10">
            {/* Input Bar */}
            <div className="flex items-center h-12 px-4 border-b border-border/60">
              <Search className="w-4 h-4 text-muted-foreground mr-3 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Projeleri, müşterileri ve kasa kayıtlarını arayın..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleSearchKeyDown}
                className="flex-grow bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground/75"
              />
              <kbd className="h-5 select-none items-center gap-0.5 rounded border border-sidebar-border bg-muted/30 px-1.5 font-mono text-[9px] font-medium text-muted-foreground flex shrink-0">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-2">
              {filteredItems.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground/60">
                  Sonuç bulunamadı.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Grouped results render */}
                  {["project", "client", "vault"].map((type) => {
                    const groupItems = filteredItems.filter((i) => i.type === type);
                    if (groupItems.length === 0) return null;

                    const title =
                      type === "project"
                        ? "Projeler"
                        : type === "client"
                        ? "Müşteriler"
                        : "Şifre Kasası (Kayıtlar)";

                    return (
                      <div key={type} className="space-y-1">
                        <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground/75 uppercase tracking-wider">
                          {title}
                        </div>
                        {groupItems.map((item) => {
                          const globalIdx = filteredItems.indexOf(item);
                          const isFocused = globalIdx === activeIndex;

                          const Icon =
                            type === "project"
                              ? Folder
                              : type === "client"
                              ? Building
                              : Key;

                          return (
                            <div
                              key={item.id}
                              onClick={() => handleSelectItem(item)}
                              onMouseEnter={() => setActiveIndex(globalIdx)}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-all duration-150",
                                isFocused
                                  ? "bg-burgundy/10 text-burgundy border-l-2 border-burgundy font-medium"
                                  : "text-foreground hover:bg-muted/40"
                              )}
                            >
                              <Icon className={cn("w-4 h-4 shrink-0", isFocused ? "text-burgundy" : "text-muted-foreground")} />
                              <span className="truncate">{item.name || item.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer hints */}
            <div className="h-9 px-4 border-t border-border/40 bg-muted/20 text-[10px] text-muted-foreground flex items-center gap-4 shrink-0">
              <span>↑↓ Gezin</span>
              <span>⏎ Seç</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
