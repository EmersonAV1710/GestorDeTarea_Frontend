import type { ReactNode, MouseEvent, KeyboardEvent, FormEvent, DragEvent } from "react";

export function RestrictedPreview({ children, active, onRestricted }: { children: ReactNode; active: boolean; onRestricted: () => void }) {
  function intercept(event: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>) {
    if (!active) return;
    const target = event.target;
    if (!(target instanceof Element) || !target.closest("button, input, select, textarea, summary, a, label")) return;
    if (event.type === "keydown" && !["Enter", " "].includes((event as KeyboardEvent).key)) return;
    event.preventDefault();
    event.stopPropagation();
    onRestricted();
  }
  function stop(event: FormEvent<HTMLDivElement> | DragEvent<HTMLDivElement>) {
    if (!active) return;
    event.preventDefault();
    event.stopPropagation();
    onRestricted();
  }
  return <div className="restricted-preview" onClickCapture={intercept} onKeyDownCapture={intercept}
    onChangeCapture={stop} onSubmitCapture={stop} onDropCapture={stop} onDragOverCapture={event => { if (active) event.preventDefault(); }}>
    {children}
  </div>;
}
