"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface LiveCursorsProps {
  userProfile: {
    email: string;
    full_name: string;
    avatar_url?: string | null;
  };
}

export function LiveCursors({ userProfile }: LiveCursorsProps) {
  const [otherCursors, setOtherCursors] = useState<any[]>([]);

  // Simple throttle helper (70ms) to avoid CPU spikes and database flooding
  const throttle = (func: Function, limit: number) => {
    let inThrottle = false;
    return function (this: any, ...args: any[]) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  };

  const getHashColorHex = (str: string) => {
    const hexColors = [
      "#c2185b", // burgundy
      "#059669", // emerald
      "#2563eb", // blue
      "#d97706", // amber
      "#4f46e5", // indigo
      "#e11d48", // rose
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % hexColors.length;
    return hexColors[index];
  };

  useEffect(() => {
    const supabase = createClient();
    
    // Subscribe to multiplayer presence channel
    const channel = supabase.channel("online-cursors", {
      config: {
        presence: {
          key: userProfile.email || "user",
        },
      },
    });

    const handleSync = () => {
      const state = channel.presenceState();
      const list: any[] = [];
      
      Object.keys(state).forEach((key) => {
        // Exclude current user from rendering other cursors
        if (key !== userProfile.email) {
          const presences = state[key] as any[];
          if (presences && presences.length > 0) {
            list.push(presences[0]);
          }
        }
      });
      
      setOtherCursors(list);
    };

    channel
      .on("presence", { event: "sync" }, handleSync)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // Initialize tracking
          await channel.track({
            email: userProfile.email,
            user_name: userProfile.full_name || userProfile.email,
            x: -0.1, // offscreen initially
            y: -0.1,
          });
        }
      });

    // Capture mouse movements with 70ms throttle
    const handleMouseMove = throttle((e: MouseEvent) => {
      const xPercent = e.clientX / window.innerWidth;
      const yPercent = e.clientY / window.innerHeight;

      channel.track({
        email: userProfile.email,
        user_name: userProfile.full_name || userProfile.email,
        x: xPercent,
        y: yPercent,
      }).catch((err) => console.error("Presence tracking failed:", err));
    }, 70);

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      channel.unsubscribe();
    };
  }, [userProfile]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden select-none">
      {otherCursors.map((cursor) => {
        if (cursor.x < 0 || cursor.y < 0) return null;
        
        const color = getHashColorHex(cursor.email || "");

        return (
          <div
            key={cursor.email}
            style={{
              position: "fixed",
              left: `${cursor.x * 100}%`,
              top: `${cursor.y * 100}%`,
              pointerEvents: "none",
              zIndex: 99999,
              transition: "all 0.1s linear",
              transform: "translate(-2px, -2px)",
            }}
            className="flex flex-col items-start gap-1 select-none pointer-events-none"
          >
            {/* Colored SVG cursor pointer */}
            <svg 
              className="w-5 h-5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] pointer-events-none select-none" 
              viewBox="0 0 24 24" 
              fill="currentColor"
              style={{ color }}
            >
              <path d="M4.5 3V17L9.5 12L16 18.5L18.5 16L12 9.5L17 4.5H4.5Z" />
            </svg>
            
            {/* Label badge */}
            <span 
              style={{ backgroundColor: color }}
              className="text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-lg truncate max-w-[120px] select-none pointer-events-none"
            >
              {cursor.user_name || "Üye"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
