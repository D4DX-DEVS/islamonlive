import type { Metadata } from "next";
import AdminClient from "./AdminClient";
import InstallBanner from "@/components/InstallBanner";
import { DATA_SOURCE, WP_URL } from "@/lib/env";
import { getAdminSession } from "@/lib/wp-admin";
import { canSeeAnalytics } from "@/lib/analytics/admin-access";
import { getAdminActor } from "@/lib/auth/actor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin workspace",
  manifest: "/admin/manifest.webmanifest",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  // database trouble shows the sign-in form rather than an error page
  const session = await getAdminSession().catch(() => null);
  const lostPasswordUrl = DATA_SOURCE === "mongo" ? "mongodb" : `${WP_URL}/wp-login.php?action=lostpassword`;
  // the Analytics tab is shown to administrators only; its APIs check again
  const analytics = session ? await canSeeAnalytics() : false;
  // the menu follows the account's current role in the database, not the one in the cookie
  const actor = session ? await getAdminActor().catch(() => null) : null;
  const role = actor?.role === "administrator" && DATA_SOURCE === "mongo" ? "administrator" : "editor";
  // links into wp-admin only mean something while WordPress is the backend
  return <><AdminClient initialUser={session && actor ? actor.name || session.username : null} role={role} lostPasswordUrl={lostPasswordUrl} wordpressAdmin={DATA_SOURCE !== "mongo"} analytics={analytics} /><InstallBanner /></>;
}
