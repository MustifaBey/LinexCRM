import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

// Helper to convert base64 to ArrayBuffer (pure Deno)
function base64ToArrayBuffer(b64: string): Uint8Array {
  const byteString = atob(b64);
  const byteArray = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    byteArray[i] = byteString.charCodeAt(i);
  }
  return byteArray;
}

// Helper to format binary data to base64url
function base64url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// Helper to get Google OAuth2 access token for FCM v1
async function getGoogleAccessToken(
  clientEmail: string,
  privateKey: string
): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const textEncoder = new TextEncoder();
  const encodedHeader = base64url(textEncoder.encode(JSON.stringify(header)));
  const encodedPayload = base64url(textEncoder.encode(JSON.stringify(payload)));
  
  const input = `${encodedHeader}.${encodedPayload}`;

  // Clean the PEM private key
  const pemContents = privateKey
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const binaryKey = base64ToArrayBuffer(pemContents);

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: { name: "SHA-256" },
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    textEncoder.encode(input)
  );
  
  const signedJwt = `${input}.${base64url(new Uint8Array(signature))}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }),
  });

  const tokenData = await tokenResponse.json();
  if (tokenData.error) {
    throw new Error(`Google Auth error: ${tokenData.error_description || tokenData.error}`);
  }
  return tokenData.access_token;
}

// Start HTTP Server
serve(async (req) => {
  // Handle CORS preflight options request
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    // 1. Parse Database Webhook Payload
    const payload = await req.json();
    console.log("[Webhook] Received Payload:", JSON.stringify(payload, null, 2));

    // Ensure it is an INSERT event on the notifications table
    if (payload.type !== "INSERT" || payload.table !== "notifications") {
      return new Response(
        JSON.stringify({ message: "Ignored: Non-INSERT event or non-notifications table" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const record = payload.record;
    if (!record) {
      return new Response(
        JSON.stringify({ error: "Missing record data in webhook payload" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { user_id, title, message, action_url } = record;

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "Missing user_id in notification record" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Instantiate Supabase admin client inside Edge Function
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Query recipient's fcm_token
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("fcm_token")
      .eq("id", user_id)
      .single();

    if (profileErr || !profile) {
      console.error("[Webhook] Failed to query user profile:", profileErr);
      return new Response(
        JSON.stringify({ error: "User profile query failed", details: profileErr }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const fcmToken = profile.fcm_token;
    if (!fcmToken) {
      console.log(`[Webhook] FCM token is not registered for user ID: ${user_id}. Skipping push notification.`);
      return new Response(
        JSON.stringify({ message: "Success: User has no registered FCM token" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // 4. Retrieve Firebase credentials from secrets (support both FIREBASE_ and FCM_ prefixes)
    const fcmClientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL") || Deno.env.get("FCM_CLIENT_EMAIL");
    const fcmPrivateKey = Deno.env.get("FIREBASE_PRIVATE_KEY") || Deno.env.get("FCM_PRIVATE_KEY");
    const fcmProjectId = Deno.env.get("FIREBASE_PROJECT_ID") || Deno.env.get("FCM_PROJECT_ID");
 
    if (!fcmClientEmail || !fcmPrivateKey || !fcmProjectId) {
      console.error("[Webhook] Missing FCM credentials in Edge Function environment variables.");
      return new Response(
        JSON.stringify({ error: "Server Configuration Error: Missing FCM environment variables" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 5. Get Google access token
    console.log("[Webhook] Exchanging Google Service Account token for FCM Access Token...");
    const accessToken = await getGoogleAccessToken(fcmClientEmail, fcmPrivateKey);

    // 6. Build FCM v1 Payload
    const randomSoundNum = Math.floor(Math.random() * 9) + 1;
    const soundName = `notify${randomSoundNum}`;
    const channelId = `high_importance_v2`;

    const fcmPayload = {
      message: {
        token: fcmToken,
        notification: {
          title: title || "Linex CRM",
          body: message || "Yeni bir bildiriminiz var.",
        },
        android: {
          priority: "high",
          notification: {
            channel_id: channelId,
            sound: soundName,
            click_action: ".MainActivity",
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              alert: {
                title: title || "Linex CRM",
                body: message || "Yeni bir bildiriminiz var.",
              },
            },
          },
        },
        data: {
          action_url: action_url || "",
        },
      },
    };

    // 7. Post push request to FCM
    console.log(`[Webhook] Sending push request to FCM for user ${user_id}...`);
    const fcmResponse = await fetch(
      `https://fcm.googleapis.com/v1/projects/${fcmProjectId}/messages:send`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(fcmPayload),
      }
    );

    const fcmResult = await fcmResponse.json();

    if (!fcmResponse.ok) {
      console.error("[Webhook] FCM Server returned error:", fcmResult);
      return new Response(
        JSON.stringify({ error: "FCM Push notification request failed", details: fcmResult }),
        { status: fcmResponse.status, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("[Webhook] Push notification sent successfully:", fcmResult);
    return new Response(
      JSON.stringify({ message: "Success: Notification pushed successfully", result: fcmResult }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );

  } catch (err: any) {
    console.error("[Webhook] Internal Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
