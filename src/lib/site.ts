import "server-only";
import { env } from "@/lib/env/server";

export const siteName = "plan.baree.be";
export const siteDescription = "Plan host for AI agents. POST an HTML plan, get back a shareable URL.";
export const siteUrl = new URL(env.APP_URL ?? "http://localhost:3000");
