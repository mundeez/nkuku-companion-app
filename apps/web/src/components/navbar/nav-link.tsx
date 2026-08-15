"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavLinkProps {
  href: string;
  label: string;
  exact?: boolean;
}

export function NavLink({ href, label, exact = false }: NavLinkProps) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={cn(
        "relative h-9 inline-flex items-center px-3 text-sm font-medium transition-colors rounded-md",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
      aria-current={active ? "page" : undefined}
    >
      {label}
      {active && (
        <span className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-primary" />
      )}
    </Link>
  );
}
