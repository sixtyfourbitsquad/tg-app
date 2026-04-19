"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Compass } from "lucide-react";
import type { CategoryDTO } from "@/types";

const CATEGORY_COLORS = [
  "#ff3b5c", "#ff6b35", "#f7c59f", "#efefd0",
  "#004e89", "#1a936f", "#88d498", "#c6dabf",
];

export default function ExplorePage() {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get<CategoryDTO[]>("/api/categories")
      .then((r) => setCategories(Array.isArray(r.data) ? r.data : []))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-dvh bg-bg-primary text-text-primary flex flex-col" style={{ paddingTop: 56 }}>
      <div className="px-4 pt-6 pb-3">
        <h1 className="text-xl font-bold">Explore</h1>
        <p className="text-xs text-white/40 mt-0.5">Browse by category</p>
      </div>

      {loading ? (
        <div className="flex-1 grid grid-cols-2 gap-3 px-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-white/5 animate-pulse aspect-[4/3]" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-white/30 gap-3">
          <Compass size={48} strokeWidth={1} />
          <p className="text-sm">No categories yet</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="grid grid-cols-2 gap-3">
            {categories.map((cat, i) => (
              <button
                key={cat.id}
                onClick={() => router.push(`/?cat=${cat.slug}`)}
                className="relative rounded-2xl overflow-hidden aspect-[4/3] flex flex-col items-start justify-end p-3 text-left"
                style={{ background: `linear-gradient(135deg, ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}33, #111)`, border: `1px solid ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}44` }}
              >
                <div
                  className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] + "33" }}
                >
                  {cat.name[0].toUpperCase()}
                </div>
                <p className="text-sm font-semibold text-white capitalize">{cat.name}</p>
                <p className="text-[10px] text-white/40 mt-0.5">{cat.video_count ?? 0} videos</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
