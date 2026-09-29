import AdminClient from "./AdminClient";
import { getAdminSession } from "@/lib/wp-admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getAdminSession();
  return <AdminClient initialUser={session?.username ?? null} />;
}
