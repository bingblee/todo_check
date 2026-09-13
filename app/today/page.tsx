import { requireUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { TodayCheckins } from "@/components/today-checkins";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await requireUser();
  const data = await getDashboardData(user);
  return <TodayCheckins data={data} />;
}
