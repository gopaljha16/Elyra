import { auth } from "@clerk/nextjs/server";
import { Shell } from "../../(onboarding)/onboarding/shell";
import { ReportQueue } from "./queue";

export default async function ReportsPage() {
  const session = await auth();
  if (!session.userId) return session.redirectToSignIn();
  return (
    <Shell>
      <h1>Reports</h1>
      <ReportQueue />
    </Shell>
  );
}
