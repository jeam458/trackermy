"use client";

import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

type MarkerLabelProps = {
  children: ReactNode;
  className?: string;
  position?: "top" | "bottom";
};

function MarkerLabel({
  children,
  className,
  position = "top",
}: MarkerLabelProps) {
  const positionClasses = {
    top: "bottom-full mb-1",
    bottom: "top-full mt-1",
  };

  return (
    <div
      className={cn(
        "absolute left-1/2 -translate-x-1/2 whitespace-nowrap",
        "text-foreground text-[10px] font-medium",
        positionClasses[position],
        className,
      )}
    >
      {children}
    </div>
  );
}

export { MarkerLabel };
