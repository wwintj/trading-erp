import "server-only";

import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";

import { auth } from "@/lib/auth";

export type AppSession = typeof auth.$Infer.Session;

export async function getCurrentSession(): Promise<AppSession | null> {
  try {
    return await auth.api.getSession({
      headers: await headers(),
    });
  } catch (error) {
    unstable_rethrow(error);
    console.error("Authentication session lookup failed");
    return null;
  }
}
