"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "./auth-provider";
import { NavLink } from "./navbar/nav-link";
import { NavGroup } from "./navbar/nav-group";
import { UserNav } from "./navbar/user-nav";
import { MobileNav } from "./navbar/mobile-nav";
import { NotificationBell } from "./navbar/notification-bell";
import { CommandPalette } from "./navbar/command-palette";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { user } = useAuth();

  if (!user) return null;

  const role = user.role;

  const navSections = React.useMemo(
    () => [
      {
        title: "Production",
        items: [
          { href: "/", label: "Dashboard" },
          { href: "/broiler-flocks", label: "Broiler Flocks" },
          ...(role === "owner" || role === "manager" || role === "sales_person"
            ? [{ href: "/sales", label: "Sales" }]
            : []),
        ],
      },
      {
        title: "Operations",
        items: [
          { href: "/diseases", label: "Diseases" },
          { href: "/alerts", label: "Alerts" },
          { href: "/vaccine-inventory", label: "Vaccine Inventory" },
          { href: "/suppliers", label: "Suppliers" },
        ],
      },
      {
        title: "Finances",
        items: [
          ...(role === "owner" || role === "manager" || role === "viewer"
            ? [{ href: "/financials", label: "Financials" }]
            : []),
          ...(role === "owner" || role === "manager" || role === "viewer"
            ? [{ href: "/ledger", label: "Ledger" }]
            : []),
          { href: "/billing", label: "Billing" },
        ],
      },
      {
        title: "Planning",
        items: [
          { href: "/projections", label: "Projections" },
          { href: "/expansion-plan", label: "Expansion Plan" },
        ],
      },
      ...(role === "owner"
        ? [
            {
              title: "Admin",
              items: [{ href: "/users", label: "Users" }],
            },
          ]
        : []),
    ],
    [role]
  );

  // Flat command palette list with all visible links
  const commandItems = React.useMemo(
    () =>
      navSections.flatMap((section) =>
        section.items.map((item) => ({
          ...item,
          group: section.title,
        }))
      ),
    [navSections]
  );

  // Single top-level items and grouped items for desktop nav
  const topLevelItems: { href: string; label: string }[] = [
    { href: "/", label: "Dashboard" },
    { href: "/broiler-flocks", label: "Broiler Flocks" },
  ];

  const groupsForDesktop = navSections
    .filter((s) => s.title !== "Production")
    .map((s) => ({ label: s.title, items: s.items }));

  return (
    <nav className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo + desktop nav */}
          <div className="flex items-center gap-4 lg:gap-8">
            <Link
              href="/"
              className="flex items-center gap-2 shrink-0"
              aria-label="Nkuku Home"
            >
              <img
                src="/logo.png"
                alt="Nkuku"
                className="h-10 w-auto max-w-none"
              />
              <span className="hidden sm:inline text-xl font-bold tracking-tight text-foreground">
                Nkuku
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {topLevelItems.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  exact={item.href === "/"}
                />
              ))}
              {groupsForDesktop.map((group) => (
                <NavGroup
                  key={group.label}
                  label={group.label}
                  items={group.items}
                />
              ))}
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            <CommandPalette items={commandItems} />
            <div className="hidden sm:block">
              <NotificationBell />
            </div>
            <div className="hidden md:block">
              <UserNav />
            </div>
            <MobileNav sections={navSections} />
          </div>
        </div>
      </div>
    </nav>
  );
}
