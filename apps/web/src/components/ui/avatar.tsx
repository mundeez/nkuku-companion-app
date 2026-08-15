"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  fallback?: string;
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, ...props }, ref) => {
    const [error, setError] = React.useState(false);
    const initials = React.useMemo(() => {
      if (!fallback) return "";
      return fallback
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
    }, [fallback]);

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted",
          className
        )}
        {...props}
      >
        {src && !error ? (
          <img
            src={src}
            alt={alt || ""}
            className="h-full w-full object-cover"
            onError={() => setError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">
            {initials || fallback?.[0]?.toUpperCase() || "?"}
          </div>
        )}
      </div>
    );
  }
);
Avatar.displayName = "Avatar";

export { Avatar };
