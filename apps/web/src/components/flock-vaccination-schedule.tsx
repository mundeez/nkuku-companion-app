"use client";

import { useApiQuery } from "@/lib/api/hooks";
import { VaccinationScheduleItem } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Syringe } from "lucide-react";
import Link from "next/link";

type ScheduleResponse = {
  schedule: { id: string; name: string; items: VaccinationScheduleItem[] } | null;
  completed: any[];
  upcoming: VaccinationScheduleItem[];
  overdue: VaccinationScheduleItem[];
  ageDays: number | null;
};

export function FlockVaccinationSchedule({ flockId }: { flockId: string }) {
  const { data, isLoading } = useApiQuery<ScheduleResponse>(
    `/api/v1/vaccination-events/schedule?flockId=${flockId}`
  );

  if (isLoading) return <p className="text-sm text-muted-foreground mb-4">Loading schedule…</p>;
  if (!data?.schedule) return null;

  const { schedule, completed, overdue } = data;
  const isDone = (item: VaccinationScheduleItem) =>
    completed.some((c: any) => c.vaccineName === item.vaccineName && Math.abs(c.ageDays - item.ageDays) <= 2);
  const isOverdue = (item: VaccinationScheduleItem) => overdue.some((o) => o.id === item.id);

  return (
    <Card className="mb-4">
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Syringe className="h-4 w-4 text-green-600" />
          Vaccination Schedule — {schedule.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2">Day</th>
                <th className="p-2">Vaccine</th>
                <th className="p-2">Type</th>
                <th className="p-2">Route</th>
                <th className="p-2">Notes</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {schedule.items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="p-2 font-medium">{item.displayDay ?? item.ageDays + 1}</td>
                  <td className="p-2">{item.vaccineName}</td>
                  <td className="p-2 text-muted-foreground">{item.vaccineType}</td>
                  <td className="p-2 text-muted-foreground">{item.adminMethod}</td>
                  <td className="p-2 text-muted-foreground max-w-xs truncate">{item.notes || "—"}</td>
                  <td className="p-2">
                    {isDone(item) ? (
                      <Badge variant="default" className="text-xs">Done</Badge>
                    ) : isOverdue(item) ? (
                      <Badge variant="destructive" className="text-xs">Overdue</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Upcoming</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-xs">
          <Link
            href="/docs/vaccines/Ross308_Zambia_Broiler_Management_Guide.md"
            target="_blank"
            className="text-primary hover:underline"
          >
            Reference: Ross 308 Vaccination Schedule guide
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
