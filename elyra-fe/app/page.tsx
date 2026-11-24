import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Shell } from "./(onboarding)/onboarding/shell";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/onboarding");

  return (
    <Shell>
      <h1>Make room for a real connection.</h1>
      <p>Share what makes you, you. Meet people who are looking for the same kind of connection.</p>
      <div className="actions">
        <Link className="quiet" href="/sign-in">Sign in</Link>
        <Link className="action" href="/sign-up">Create an account</Link>
      </div>
    </Shell>
  );
}
