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
    <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-around h-14 bg-transparent">
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
              size={22}
              strokeWidth={active ? 2.2 : 1.8}
              className="transition-all duration-150"
              style={{
                color: active ? "#ff3b5c" : "#555555",
                filter: active ? "drop-shadow(0 0 6px #ff3b5c88)" : "none",
              }}
            />
          </button>
        );
      })}
    </nav>
  );
}
