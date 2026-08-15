"use client";

import * as React from "react";
import Link from "next/link";
import { LogOut, Moon, Settings, Sun, CreditCard } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useTheme } from "@/components/theme-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserNav() {
  const { user, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();

  if (!user) return null;

  const name = user.name || user.email;
  const nextTheme = resolvedTheme === "dark" ? "light" : "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-9 w-9 rounded-full"
          aria-label="Open user menu"
        >
          <Avatar src={user.image || null} alt={name} fallback={name} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
            {user.role && (
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground pt-0.5">
                {user.role}
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link
              href="/settings"
              className="cursor-pointer w-full items-center"
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href="/billing"
              className="cursor-pointer w-full items-center"
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Billing & Plans
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setTheme(nextTheme)}
            className="cursor-pointer"
          >
            {resolvedTheme === "dark" ? (
              <Sun className="mr-2 h-4 w-4" />
            ) : (
              <Moon className="mr-2 h-4 w-4" />
            )}
            {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => logout()}
          className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
