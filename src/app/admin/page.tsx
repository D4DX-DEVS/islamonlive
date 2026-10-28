import type { Metadata } from "next";
import AdminClient from "./AdminClient";
import InstallBanner from "@/components/InstallBanner";
import { DATA_SOURCE, WP_URL } from "@/lib/env";
import { getAdminSession } from "@/lib/wp-admin";
import { canSeeAnalytics } from "@/lib/analytics/admin-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin workspace",
  manifest: "/admin/manifest.webmanifest",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const session = await getAdminSession();
  const lostPasswordUrl = DATA_SOURCE === "mongo" ? "mongodb" : `${WP_URL}/wp-login.php?action=lostpassword`;
  // the Analytics tab is shown to administrators only; its APIs check again
  const analytics = session ? await canSeeAnalytics() : false;
  // links into wp-admin only mean something while WordPress is the backend
  return <><AdminClient initialUser={session?.username ?? null} lostPasswordUrl={lostPasswordUrl} wordpressAdmin={DATA_SOURCE !== "mongo"} analytics={analytics} /><InstallBanner /></>;
}
