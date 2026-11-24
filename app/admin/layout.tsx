import { BottomNav } from "./_components/bottom-nav";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}
