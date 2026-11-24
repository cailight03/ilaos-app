import { Suspense } from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { hasSession } from "@/src/lib/session";
import { loginWithGoogle } from "./actions";

export default function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  return (
    <Suspense>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginContent({ searchParams }: { searchParams: PageProps<"/admin/login">["searchParams"] }) {
  if (await hasSession()) redirect("/admin");

  const { error } = await searchParams;
  const message =
    error === "AccessDenied"
      ? "Access denied. This Google account isn't authorized to use this dashboard."
      : error
        ? "Sign-in failed. Please try again."
        : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm animate-ios-in flex-col justify-center gap-6 px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex flex-col items-center text-center">
        <Image
          src="/logo-square.png"
          alt="Ilao's Microbakery"
          width={500}
          height={500}
          priority
          className="size-40 rounded-[22%] shadow-sm"
        />
        <p className="mt-4 text-[15px] text-label2">Sign in to manage your bakery</p>
      </div>
      {message && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-separator bg-card p-3.5 text-[15px] text-red-600 shadow-sm"
        >
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          {message}
        </div>
      )}
      <form action={loginWithGoogle}>
        <button
          type="submit"
          className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-separator bg-card text-[17px] font-semibold shadow-sm transition active:scale-[0.98] active:opacity-80"
        >
          <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
            <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
          </svg>
          Sign in with Google
        </button>
      </form>
    </main>
  );
}
