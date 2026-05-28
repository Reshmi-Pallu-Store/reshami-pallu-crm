import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const CRM_PASSWORD = process.env.CRM_PASSWORD || "reshmi-founder-2026";

// Handle admin authentication
export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    if (password !== CRM_PASSWORD) {
      return NextResponse.json({ error: "Invalid administrative password" }, { status: 401 });
    }

    // Set secure cookie
    const cookieStore = await cookies();
    cookieStore.set("crm_session", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Check if authenticated
export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get("crm_session");

  if (!session || session.value !== "authenticated") {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true });
}

// Log out admin
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("crm_session");
  return NextResponse.json({ success: true });
}
