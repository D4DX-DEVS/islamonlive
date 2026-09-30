import type { Metadata } from "next";
import AdminClient from "./AdminClient";
import InstallBanner from "@/components/InstallBanner";
import { getAdminSession } from "@/lib/wp-admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin workspace",
  manifest: "/admin/manifest.webmanifest",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const session = await getAdminSession();
  return <><AdminClient initialUser={session?.username ?? null} /><InstallBanner /></>;
}
