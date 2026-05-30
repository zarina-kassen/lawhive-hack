import * as React from "react";
import { cn } from "@/lib/utils";

type PillColor = "primary" | "success" | "warning" | "destructive" | "info" | "muted";

const COLOR_STYLES: Record<PillColor, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-chart-4/10 text-chart-4",
  warning: "bg-chart-2/10 text-chart-2",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-chart-3/10 text-chart-3",
  muted: "bg-muted text-muted-foreground",
};

interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: PillColor;
  icon?: React.ReactNode;
}

function Pill({ color = "primary", icon, className, children, ...props }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        COLOR_STYLES[color],
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}

export { Pill };
