import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/encryption";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Authenticate user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Validate role is owner or admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single() as any;

    if (!profile || !["owner", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3. Process payload
    const body = await request.json();
    const { text } = body;

    if (typeof text !== "string") {
      return NextResponse.json({ error: "Invalid text payload" }, { status: 400 });
    }

    const encrypted = encrypt(text);

    return NextResponse.json({ encrypted });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Encryption failed" },
      { status: 500 }
    );
  }
}
