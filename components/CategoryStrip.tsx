"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import type { CategoryDTO } from "@/types";

export function CategoryStrip({ activeSlug }: { activeSlug?: string }) {
  const [categories, setCategories] = useState<CategoryDTO[]>([]);

  useEffect(() => {
    axios
      .get<CategoryDTO[]>("/api/categories")
      .then((r) => setCategories(Array.isArray(r.data) ? r.data : []))
      .catch(() => setCategories([]));
  }, []);

  if (categories.length === 0) return null;

  return (
    <div className="absolute left-0 right-0 z-20 pointer-events-auto" style={{ top: 56 }}>
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-3 py-2">
        <Link
          href="/"
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
            !activeSlug
              ? "bg-accent/20 border-accent text-accent"
              : "bg-black/40 border-white/15 text-white/70"
          }`}
        >
          All
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/?cat=${encodeURIComponent(c.slug)}`}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium border capitalize transition-colors ${
              activeSlug === c.slug
                ? "bg-accent/20 border-accent text-accent"
                : "bg-black/40 border-white/15 text-white/70"
            }`}
          >
            {c.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
