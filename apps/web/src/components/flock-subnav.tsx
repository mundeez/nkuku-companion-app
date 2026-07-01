"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ClipboardList, Thermometer, Pill, CalendarDays, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const subPages = [
  { segment: "tasks", label: "Tasks", icon: ClipboardList },
  { segment: "environment", label: "Environment", icon: Thermometer },
  { segment: "medication", label: "Medication", icon: Pill },
  { segment: "calendar", label: "Calendar", icon: CalendarDays },
];

export function FlockSubNav() {
  const params = useParams();
  const pathname = usePathname();
  const flockId = params.id as string;
  const basePath = `/broiler-flocks/${flockId}`;

  return (
    <div className="flex items-center gap-2 mb-6 flex-wrap">
      <Button variant="outline" size="sm" asChild>
        <Link href={basePath}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Flock
        </Link>
      </Button>
      <div className="flex gap-1 flex-wrap">
        {subPages.map(({ segment, label, icon: Icon }) => {
          const href = `${basePath}/${segment}`;
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={segment}
              href={href}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
