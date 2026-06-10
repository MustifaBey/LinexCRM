import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { daysUntil } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // 1. Authorization Header check
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized access" },
      { status: 401 }
    );
  }

  // 2. Instantiate Supabase Client (bypassing RLS with service role key if available)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

  // 3. Compute date range: <= 30 days from now
  const today = new Date();
  const future = new Date();
  future.setDate(today.getDate() + 30);
  
  const futureStr = future.toISOString().split("T")[0];

  // 4. Query expiring records
  const { data: expiringRecords, error: recordsError } = await supabaseAdmin
    .from("domain_records")
    .select("*, client:clients(id, name, portal_user_id)")
    .lte("expiration_date", futureStr) as any;

  if (recordsError) {
    return NextResponse.json({ error: recordsError.message }, { status: 500 });
  }

  const records = expiringRecords || [];

  if (records.length === 0) {
    return NextResponse.json({ message: "No expiring services found today", count: 0 });
  }

  // 5. Fetch all agency staff profiles to notify
  const { data: staff, error: staffError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .in("role", ["owner", "admin", "member"]) as any;

  if (staffError) {
    return NextResponse.json({ error: staffError.message }, { status: 500 });
  }

  const staffList = staff || [];
  const notificationsToInsert: any[] = [];

  // 6. Build notifications payload
  for (const record of records) {
    const days = daysUntil(record.expiration_date);
    
    let title = "";
    let message = "";
    let notifType: "error" | "warning" | "info" = "info";

    const clientName = record.client?.name || "Unassigned Client";

    if (days < 0) {
      title = `Service Expired: ${record.domain_name}`;
      message = `The ${record.service_type} for client "${clientName}" expired on ${record.expiration_date} (${Math.abs(days)} days ago). Renew immediately!`;
      notifType = "error";
    } else {
      title = `Service Expiring: ${record.domain_name}`;
      const autoText = record.auto_renew ? " (Auto-renewal enabled)" : " (Manual renewal required)";
      message = `The ${record.service_type} for client "${clientName}" expires in ${days} days on ${record.expiration_date}.${autoText}`;
      notifType = record.auto_renew ? "info" : "warning";
    }

    const recipients = new Set<string>();
    
    // Add all staff members
    staffList.forEach((member: any) => recipients.add(member.id));

    // Add client portal user if registered
    if (record.client?.portal_user_id) {
      recipients.add(record.client.portal_user_id);
    }

    // Add record creator
    if (record.created_by) {
      recipients.add(record.created_by);
    }

    // Build notifications list
    Array.from(recipients).forEach((userId) => {
      notificationsToInsert.push({
        user_id: userId,
        title,
        message,
        type: notifType,
        action_url: `/domains`,
      });
    });
  }

  // 7. Bulk Insert notifications
  if (notificationsToInsert.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from("notifications")
      .insert(notificationsToInsert);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    message: "Alarm system cron executed successfully",
    alarmsTriggered: records.length,
    notificationsSent: notificationsToInsert.length,
  });
}

// Support POST triggers for standard webhook engines
export async function POST(request: NextRequest) {
  return GET(request);
}
