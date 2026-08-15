"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface NavGroupProps {
  label: string;
  items: { href: string; label: string }[];
}

export function NavGroup({ label, items }: NavGroupProps) {
  const pathname = usePathname();
  const isActive = items.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-9 gap-1 px-3 text-sm font-medium relative",
            isActive
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          {isActive && (
            <span className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-primary" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <DropdownMenuItem key={item.href} asChild>
              <Link
                href={item.href}
                className={cn(
                  "cursor-pointer",
                  active && "bg-accent text-accent-foreground"
                )}
              >
                {item.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
