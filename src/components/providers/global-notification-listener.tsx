"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function GlobalNotificationListener({ userId }: { userId?: string }) {
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    // 1. Web push permission request
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission();
    }

    const fireSiren = (title: string, body: string) => {
      // Fire Desktop Toast
      if (Notification.permission === "granted") {
        new Notification(title, { body, silent: true });
      }
    };

    // 2. Web push notification listener via Supabase Realtime
    const radarChannel = supabase
      .channel("global_radar_channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          if (!payload.new.user_id || String(payload.new.user_id) === String(userId)) {
            fireSiren(
              payload.new.title || "LinexCRM Bildirim",
              payload.new.message || "Yeni bir bildiriminiz var."
            );
          }
        }
      )
      .subscribe();

    // 3. Capacitor Native Push Notification Integration
    let isNative = false;
    const initNativePush = async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) {
          console.log("[PushNotifications] Not running on native platform, skipping Native Push setup.");
          return;
        }
        isNative = true;

        const { PushNotifications } = await import("@capacitor/push-notifications");

        // Request permission to show notifications
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === "prompt") {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive === "granted") {
          // Register with FCM/APNs to receive push notifications
          await PushNotifications.register();
        } else {
          console.warn("[PushNotifications] Permission not granted for native push.");
        }

        // Listeners for native push events
        await PushNotifications.addListener("registration", (token) => {
          console.log("[PushNotifications] Device Token (FCM):", token.value);
          // Log or save this token in Supabase linked to the user
        });

        await PushNotifications.addListener("registrationError", (error) => {
          console.error("[PushNotifications] Registration error:", error);
        });

        await PushNotifications.addListener("pushNotificationReceived", (notification) => {
          console.log("[PushNotifications] Push received in foreground:", notification);
        });

        await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
          console.log("[PushNotifications] Push action performed:", action);
        });

      } catch (err) {
        console.error("[PushNotifications] Failed to init native push:", err);
      }
    };

    initNativePush();

    return () => {
      supabase.removeChannel(radarChannel);
      if (isNative) {
        import("@capacitor/push-notifications").then(({ PushNotifications }) => {
          PushNotifications.removeAllListeners();
        }).catch(err => {
          console.error("[PushNotifications] Failed to clean up listeners:", err);
        });
      }
    };
  }, [userId]);

  return null;
}
