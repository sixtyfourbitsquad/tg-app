import { BottomNav } from "@/components/BottomNav";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full h-dvh">
      {children}
      <BottomNav />
    </div>
  );
}
