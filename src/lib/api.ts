import axios from "axios";

/**
 * Server-side axios client for calling the Laravel API directly.
 *
 * Only import this from Route Handlers / Server Components — it points at
 * the private API base URL (see API_URL in .env.example) and is never
 * bundled for the browser. Client components should call our own
 * Route Handlers (under /api/*) instead, which proxy through this client
 * and attach the auth cookie — this is the BFF pattern described in
 * 00_mefie_tickets_system_architecture.md Section 1.
 */
export const serverApi = axios.create({
  baseURL: process.env.API_URL ?? "http://localhost:8000",
  timeout: 5000,
  headers: {
    Accept: "application/json",
  },
});
