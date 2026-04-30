import { requireAdmin } from "@/lib/auth";

// Gates every route under /admin. Non-admins (including caregivers
// and seniors) are bounced to the homepage by requireAdmin.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return <>{children}</>;
}
