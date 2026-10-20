"use client";

/** The clock, as state: it ticks on an interval rather than being read during render. */
import { useEffect, useState } from "react";

export function useNow(ms = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
