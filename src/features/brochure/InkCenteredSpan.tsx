import React, { useLayoutEffect, useRef } from "react";
import { centerTextInk } from "./textInkCenter";

export function InkCenteredSpan({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    let disposed = false;
    const update = () => {
      if (!disposed && ref.current) centerTextInk(ref.current);
    };
    update();
    const observer =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(update)
        : undefined;
    if (ref.current) observer?.observe(ref.current);
    void document.fonts?.ready.then(update);
    return () => {
      disposed = true;
      observer?.disconnect();
    };
  }, [children]);
  return (
    <span
      {...props}
      className={`ink-centered-text ${className}`.trim()}
      ref={ref}
    >
      {children}
    </span>
  );
}
