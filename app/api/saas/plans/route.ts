import { NextResponse } from "next/server";
import { SAAS_PLANS } from "@/lib/saas-plans";

export async function GET() {
  return NextResponse.json({
    plans: SAAS_PLANS,
    defaultPlan: "free",
  });
}
