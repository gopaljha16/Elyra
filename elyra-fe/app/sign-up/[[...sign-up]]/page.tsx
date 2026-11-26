import { SignUp } from "@clerk/nextjs";
import { Brand } from "@/app/(onboarding)/onboarding/shell";

export default function Page() {
  return (
    <main className="elyra-ambient flex min-h-dvh flex-col items-center justify-center px-4 py-10 gap-6">
      <Brand />
      <SignUp
        appearance={{
          variables: {
            colorPrimary: "#842b50",
            colorText: "#2e1924",
            colorTextSecondary: "#66525e",
            colorBackground: "#fffaf7",
            colorInputBackground: "#fffdfb",
            colorInputText: "#2e1924",
            borderRadius: "0.75rem",
          },
          elements: {
            card: "shadow-[0_20px_60px_-15px_rgba(102,52,89,0.14)] border border-[#e8d8dd] rounded-2xl",
            formButtonPrimary:
              "bg-[#842b50] hover:bg-[#67203e] rounded-full font-semibold transition-all",
            footerActionLink: "text-[#842b50] hover:text-[#67203e] font-semibold",
          },
        }}
      />
    </main>
  );
}
