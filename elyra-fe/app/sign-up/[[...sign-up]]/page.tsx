import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4 py-12">
      <SignUp
        appearance={{
          elements: {
            formButtonPrimary: "bg-indigo-600 hover:bg-indigo-700 transition-all",
            card: "shadow-2xl border border-zinc-100 dark:border-zinc-800 rounded-2xl",
          },
        }}
      />
    </main>
  );
}
