"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search,
  Sparkles,
  Home,
  MessageSquare,
  Users,
  Folder,
  Image,
  Key,
  Settings,
  CornerDownLeft,
  Camera,
} from "lucide-react";

interface ActionItem {
  id: string;
  label: string;
  route: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ACTIONS: ActionItem[] = [
  { id: "screenshot", label: "Ekran Görüntüsü Al", route: "screenshot", desc: "Alan seçerek ekran görüntüsü alır, yükler ve linki kopyalar", icon: Camera },
  { id: "dashboard", label: "Dashboard'a Git", route: "/", desc: "Ana kontrol panelini açar", icon: Home },
  { id: "chat", label: "Ekip Sohbetini Aç", route: "/chat", desc: "Ekip arkadaşlarınızla yazışın", icon: MessageSquare },
  { id: "clients", label: "Müşterileri Listele", route: "/clients", desc: "Müşteri rehberi ve detayları", icon: Users },
  { id: "projects", label: "Proje Listesini Gör", route: "/projects", desc: "Aktif projeleri ve aşamaları listeler", icon: Folder },
  { id: "media", label: "Medya Kasasını Aç", route: "/media", desc: "Ajans dosya ve görsellerini yönetin", icon: Image },
  { id: "vault", label: "Şifre Kasa Girişi", route: "/vault", desc: "Müşteri ve ajans şifre kasası", icon: Key },
  { id: "settings", label: "Profil Ayarları", route: "/settings", desc: "Uygulama ve hesap ayarları", icon: Settings },
];

export default function CommandPalettePage() {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 1. Override body background to transparent for seamless overlay look
  useEffect(() => {
    document.body.style.backgroundColor = "transparent";
    return () => {
      document.body.style.backgroundColor = "";
    };
  }, []);

  // 2. Auto-focus on input mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Filter actions based on search input
  const filteredActions = ACTIONS.filter(
    (act) =>
      act.label.toLowerCase().includes(search.toLowerCase()) ||
      act.desc.toLowerCase().includes(search.toLowerCase())
  );

  // Reset selection index when search query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // 3. Navigation triggers
  const handleSelectAction = async (action: ActionItem) => {
    const electron = (window as any).electron;

    if (action.id === "screenshot") {
      if (!electron?.openSnipWindow) {
        alert("Electron API'sine erişilemiyor. Lütfen masaüstü uygulamasını kullanın.");
        return;
      }
      // Hide palette then open the snip overlay window.
      // All capture / crop / upload / clipboard logic lives in /snip page.
      electron.hidePalette();
      await electron.openSnipWindow();
      return;
    }

    if (electron) {
      electron.navigateMain(action.route);
      electron.hidePalette();
    } else {
      console.log("Navigating to:", action.route);
    }
  };

  const handleClosePalette = () => {
    const electron = (window as any).electron;
    if (electron) {
      electron.hidePalette();
    }
  };

  // Keyboard navigation listeners (Arrow Up/Down, Enter, ESC)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClosePalette();
        return;
      }

      if (filteredActions.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredActions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredActions.length) % filteredActions.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleSelectAction(filteredActions[selectedIndex]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [filteredActions, selectedIndex]);

  // Scroll selected item into view inside scroll area
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4 select-none w-screen h-screen overflow-hidden bg-transparent"
      onClick={handleClosePalette}
    >
      {/* Container Card */}
      <div
        className="w-full max-w-[660px] h-[380px] bg-zinc-950/85 border border-zinc-800/80 rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()} // Prevent click bubbling to overlay
      >
        {/* Search Input Area */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-zinc-800/60 bg-zinc-900/10">
          <Search className="w-5 h-5 text-muted-foreground/60 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Bir komut arayın veya kısayol seçin..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-0 text-foreground placeholder-muted-foreground/50 text-sm focus:outline-none focus:ring-0 w-full"
          />
          <div className="flex items-center gap-1 bg-zinc-800/50 border border-zinc-700/40 px-2 py-0.5 rounded text-[10px] font-bold text-muted-foreground font-mono">
            <span>ESC</span>
          </div>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-2" ref={listRef}>
          {filteredActions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <Sparkles className="w-8 h-8 text-burgundy/60 animate-pulse mb-2" />
              <p className="text-sm font-semibold text-muted-foreground">Sonuç bulunamadı</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Aramanızla eşleşen bir işlem bulunmuyor.</p>
            </div>
          ) : (
            filteredActions.map((action, index) => {
              const Icon = action.icon;
              const isSelected = index === selectedIndex;

              return (
                <button
                  key={action.id}
                  onClick={() => handleSelectAction(action)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center justify-between text-left px-3.5 py-3 rounded-xl transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? "bg-burgundy text-white shadow-md shadow-burgundy/25"
                      : "hover:bg-zinc-800/45 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-1.5 rounded-lg shrink-0 ${
                      isSelected ? "bg-white/10" : "bg-zinc-800/55"
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold leading-tight">{action.label}</div>
                      <div className={`text-[10px] truncate leading-normal mt-0.5 ${
                        isSelected ? "text-white/80" : "text-muted-foreground/60"
                      }`}>
                        {action.desc}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded bg-white/10 text-[9px] font-bold text-white/95 uppercase font-mono">
                      <span>Git</span>
                      <CornerDownLeft className="w-2.5 h-2.5" />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="h-9 px-4 border-t border-zinc-800/60 bg-zinc-950 flex items-center justify-between text-[10px] text-muted-foreground/60 font-semibold select-none">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="bg-zinc-800 px-1 py-0.5 rounded text-[8px] font-mono">↑↓</span> Seç</span>
            <span className="flex items-center gap-1"><span className="bg-zinc-800 px-1 py-0.5 rounded text-[8px] font-mono">Enter</span> Çalıştır</span>
          </div>
          <div>
            <span>LinexCRM Medya Asistanı</span>
          </div>
        </div>
      </div>
    </div>
  );
}
