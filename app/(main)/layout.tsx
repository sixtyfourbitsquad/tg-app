import { BottomNav } from "@/components/BottomNav";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full min-h-dvh h-dvh bg-bg-primary text-text-primary">
      {children}
      <BottomNav />
    </div>
  );
}
