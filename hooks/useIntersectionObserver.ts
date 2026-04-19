"use client";

import { RefObject, useEffect, useState } from "react";

interface Options extends IntersectionObserverInit {
  freezeOnceVisible?: boolean;
}

/**
 * Returns true when the element is intersecting at the given threshold.
 * freezeOnceVisible: once true, never goes back to false (useful for lazy loads).
 */
export function useIntersectionObserver(
  elementRef: RefObject<Element | null>,
  options: Options = {}
): boolean {
  const {
    threshold = 0,
    root = null,
    rootMargin = "0px",
    freezeOnceVisible = false,
  } = options;

  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    // Already visible and frozen — no need to observe further
    if (freezeOnceVisible && isIntersecting) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting;
        setIsIntersecting(visible);
      },
      { threshold, root, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [elementRef, threshold, root, rootMargin, freezeOnceVisible, isIntersecting]);

  return isIntersecting;
}
