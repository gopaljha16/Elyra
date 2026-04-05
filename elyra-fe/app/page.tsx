"use client";

import { Show, SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/nextjs";
import { useState } from "react";

export default function Home() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [backendStatus, setBackendStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkBackend = async () => {
    setIsLoading(true);
    try {
      const token = await getToken();
      const response = await fetch("http://localhost:5000/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setBackendStatus(data);
    } catch (error) {
      console.error(error);
      setBackendStatus({ error: "Failed to connect to backend" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-zinc-50 dark:bg-zinc-950 p-4">
      <div className="absolute top-4 left-4 text-xs text-zinc-400">
        Frontend status: Active
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Elyra
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          Welcome to your new platform.
        </p>
      </div>

      <Show when="signed-out">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <SignInButton mode="modal">
            <button className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-all shadow-lg hover:shadow-indigo-500/20">
              Get Started
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="px-8 py-3 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 transition-all">
              Create Account
            </button>
          </SignUpButton>
        </div>
      </Show>

      <Show when="signed-in">
        <div className="flex flex-col items-center gap-6 w-full max-w-md p-8 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-100 dark:border-zinc-800 transition-all animate-in fade-in zoom-in duration-300">
          <div className="space-y-1 text-center">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Authed Session
            </p>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Welcome back!
            </h2>
          </div>

          <div className="flex items-center gap-4 py-2">
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox: "w-12 h-12 shadow-sm ring-2 ring-zinc-50 dark:ring-zinc-800",
                },
              }}
            />
            <div className="h-10 w-px bg-zinc-100 dark:bg-zinc-800" />
            <button
              onClick={checkBackend}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg transition-colors flex items-center gap-2"
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-zinc-400 border-t-zinc-800 dark:border-zinc-600 dark:border-t-zinc-200 rounded-full animate-spin" />
              ) : (
                "Verify Backend"
              )}
            </button>
          </div>

          {backendStatus && (
            <div className="w-full mt-2 p-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <p className="text-xs font-mono text-zinc-500 mb-1">Backend Response:</p>
              <pre className="text-[10px] sm:text-xs font-mono text-indigo-600 dark:text-indigo-400 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(backendStatus, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </Show>
    </main>
  );
}
 
