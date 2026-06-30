"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { BroilerFlock, FlockCalendarDay } from "@/lib/types";

export default function PrintCalendarPage() {
  const params = useParams();
  const { user, isLoading } = useAuth();
  const flockId = params.id as string;

  const [flock, setFlock] = useState<BroilerFlock | null>(null);
  const [days, setDays] = useState<FlockCalendarDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) return;
    if (user && flockId) {
      Promise.all([
        apiFetch<BroilerFlock>(`/api/v1/broiler-flocks/${flockId}`),
        apiFetch<{ days: FlockCalendarDay[] }>(`/api/v1/broiler-flocks/${flockId}/summary`),
      ])
        .then(([f, s]) => {
          setFlock(f);
          setDays(s.days || []);
        })
        .finally(() => setLoading(false));
    }
  }, [user, isLoading, flockId]);

  useEffect(() => {
    if (!loading) {
      window.print();
    }
  }, [loading]);

  if (isLoading || loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-6 text-sm print:p-0">
      <div className="mb-4 print:mb-2">
        <h1 className="text-2xl font-bold">Ross 308 Broiler Vaccination & Management Calendar</h1>
        <p className="text-muted-foreground">
          Flock: {flock?.name} · Breed: {flock?.breed?.name} · Hatch Date: {flock?.startDate ? new Date(flock.startDate).toLocaleDateString() : "-"} · Target: Day {flock?.targetAge || 42}
        </p>
      </div>

      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 p-2 text-left">Day</th>
            <th className="border border-gray-300 p-2 text-left">Date</th>
            <th className="border border-gray-300 p-2 text-left">Vaccination / Booster</th>
            <th className="border border-gray-300 p-2 text-left">Feed Phase</th>
            <th className="border border-gray-300 p-2 text-left">Management Tasks</th>
            <th className="border border-gray-300 p-2 text-left">Health / Stress Support</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.day} className={day.vaccines.length > 0 ? "bg-green-50" : ""}>
              <td className="border border-gray-300 p-2 font-medium">{day.age}</td>
              <td className="border border-gray-300 p-2">{new Date(day.date).toLocaleDateString()}</td>
              <td className="border border-gray-300 p-2">
                {day.vaccines.length > 0
                  ? day.vaccines.map((v) => `${v.vaccineName} (${v.completed ? "Done" : "Due"})`).join("; ")
                  : ""}
              </td>
              <td className="border border-gray-300 p-2">{day.feedPhase}</td>
              <td className="border border-gray-300 p-2">
                <ul className="list-disc list-inside">
                  {day.managementTasks.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </td>
              <td className="border border-gray-300 p-2">{day.healthSupport}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 text-xs text-muted-foreground print:hidden">
        <p>Based on Aviagen Ross 308 guidelines and Zambia-specific research (NDV genotype VII.2, IBD MDA/Deventer formula, Ceva Transmune, MSD Southern Africa schedule). Always follow local veterinary advice and product labels.</p>
      </div>
    </div>
  );
}
