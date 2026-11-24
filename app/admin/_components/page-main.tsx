import type { ReactNode } from "react";

/** Page container: phone-width column on mobile, wider on tablet, full content area on desktop. */
export function PageMain({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(5rem+env(safe-area-inset-bottom))] md:max-w-3xl md:px-6 lg:min-h-[calc(100dvh-4rem)] lg:max-w-6xl lg:px-8 lg:pt-6 lg:pb-10">
      {children}
    </main>
  );
}
