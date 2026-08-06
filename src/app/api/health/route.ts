import { NextResponse } from "next/server";
import { serverApi } from "@/lib/api";

/**
 * BFF health-check proxy.
 *
 * This is the Milestone 0 "one placeholder end-to-end slice" from
 * 09_mvp_development_plan.md: it proves the Next.js -> Laravel server-side
 * call chain works, without requiring the browser to know the API's
 * address. Once the Laravel side exists (see mefie-tickets-api's
 * bootstrap runbook), it should expose GET /api/health returning
 * { status: "ok", service, timestamp }.
 *
 * Until then, this route degrades gracefully instead of throwing, so the
 * frontend can ship and be demoed before the backend is bootstrapped.
 */
export async function GET() {
  try {
    const { data } = await serverApi.get("/api/health");
    return NextResponse.json({ frontend: "ok", backend: data });
  } catch {
    return NextResponse.json(
      {
        frontend: "ok",
        backend: null,
        backendError:
          "Laravel API is not reachable yet at " +
          (process.env.API_URL ?? "http://localhost:8000"),
      },
      { status: 200 },
    );
  }
}
