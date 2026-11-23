import Image from "next/image";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm animate-ios-in flex-col justify-center gap-6 px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex flex-col items-center text-center">
        <Image src="/logo.png" alt="Ilao's Microbakery" width={200} height={200} priority className="size-48" />
        <p className="-mt-4 text-[15px] text-label2">Enter your PIN to unlock the dashboard</p>
      </div>
      <LoginForm />
    </main>
  );
}
