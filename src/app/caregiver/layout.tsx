import { requireCaregiver } from "@/lib/auth";

// Gates every route under /caregiver. Seniors (anyone who is the
// senior_id of an active link) are bounced to /today instead of being
// shown caregiver-only chrome they can't actually act on.
export default async function CaregiverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCaregiver();
  return <>{children}</>;
}
