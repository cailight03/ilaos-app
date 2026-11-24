import Image from "next/image";
import { LogOut } from "lucide-react";
import type { SessionUser } from "@/src/lib/session";
import { logout } from "../login/actions";

export function ProfileCard({ user }: { user: SessionUser }) {
  return (
    <section aria-label="Account" className="flex items-center gap-3 rounded-xl border border-separator bg-card p-3 shadow-sm">
      {user.image ? (
        <Image
          src={user.image}
          alt=""
          width={44}
          height={44}
          referrerPolicy="no-referrer"
          className="size-11 shrink-0 rounded-full"
        />
      ) : (
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-[17px] font-semibold text-white">
          {(user.name ?? user.email).charAt(0).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        {user.name && <p className="truncate text-[17px] font-medium">{user.name}</p>}
        <p className="truncate text-[15px] text-label2">{user.email}</p>
      </div>
      <form action={logout}>
        <button
          aria-label="Sign out"
          className="flex size-11 items-center justify-center rounded-full bg-fill text-brand transition active:scale-90 active:opacity-70"
        >
          <LogOut className="size-5" aria-hidden />
        </button>
      </form>
    </section>
  );
}
