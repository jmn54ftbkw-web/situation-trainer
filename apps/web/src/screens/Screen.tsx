import type { ReactNode } from "react";

/** Matches the legacy `.screen.active.screen-enter` structure so the ported CSS applies as-is. */
export function Screen({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <section className="screen active screen-enter" id={`screen-${id}`} aria-label={label}>
      {children}
    </section>
  );
}
