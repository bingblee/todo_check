import { requireUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { Dashboard } from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await requireUser();
  const data = await getDashboardData(user);
  return <Dashboard user={{ username: user.username, role: user.role }} data={data} initialView="today" />;
}
