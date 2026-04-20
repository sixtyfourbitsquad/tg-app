"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, Compass, Bookmark, User } from "lucide-react";

const TABS = [
  { icon: Home,     href: "/",        label: "Home"    },
  { icon: Compass,  href: "/explore", label: "Explore" },
  { icon: Bookmark, href: "/saved",   label: "Saved"   },
  { icon: User,     href: "/profile", label: "Profile" },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 flex items-center justify-around h-[60px]"
      style={{
        background: "rgba(0,0,0,0.95)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      {TABS.map(({ icon: Icon, href, label }) => {
        const active = pathname === href;
        return (
          <button
            key={href}
            onClick={() => router.push(href)}
            aria-label={label}
            className="flex-1 flex items-center justify-center h-full"
          >
            <Icon
              size={24}
              strokeWidth={active ? 2.2 : 1.8}
              className="transition-colors duration-150"
              style={{ color: active ? "#ff3b5c" : "#555555" }}
            />
          </button>
        );
      })}
    </nav>
  );
}
