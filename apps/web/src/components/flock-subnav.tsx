"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ClipboardList, Thermometer, Pill, CalendarDays, ArrowLeft, ShoppingCart, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const subPages = [
  { segment: "tasks", label: "Tasks", icon: ClipboardList },
  { segment: "environment", label: "Environment", icon: Thermometer },
  { segment: "medication", label: "Medication", icon: Pill },
  { segment: "calendar", label: "Calendar", icon: CalendarDays },
  { segment: "sales", label: "Sales", icon: ShoppingCart },
  { segment: "documents", label: "Documents", icon: FileText },
];

export function FlockSubNav() {
  const params = useParams();
  const pathname = usePathname();
  const flockId = params.id as string;
  const basePath = `/broiler-flocks/${flockId}`;

  return (
    <div className="flex items-center gap-2 mb-6">
      <Button variant="outline" size="sm" asChild>
        <Link href={basePath}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Flock
        </Link>
      </Button>
      <nav className="flex gap-1 overflow-x-auto no-scrollbar pb-1 -mb-1">
        {subPages.map(({ segment, label, icon: Icon }) => {
          const href = `${basePath}/${segment}`;
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={segment}
              href={href}
              className={cn(
                "relative inline-flex shrink-0 items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4" />
              {label}
              {active && (
                <span className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
