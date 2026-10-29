import { FeedProjectionResult, FeedProjectionType } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

/**
 * Grouped feed projection: one row per feed type (Starter, Grower, …).
 * Required / Purchased / Remaining / Proj. Cost each split into a sub-column
 * per configured bag size. Status shows a coverage bar with % inside plus
 * money spent so far and remaining cost underneath.
 */
export function FeedProjectionTable({
  projection,
  onPurchase,
}: {
  projection: FeedProjectionResult;
  onPurchase?: (type: FeedProjectionType) => void;
}) {
  const types = projection.types ?? [];
  if (types.length === 0) return null;

  // Union of configured bag sizes across types, largest first (e.g. [50, 25]).
  const sizeUnits = [...new Set(types.flatMap((t) => t.sizes.map((s) => s.unitKg)))].sort((a, b) => b - a);
  const n = sizeUnits.length;

  const cell = (t: FeedProjectionType, u: number, val: (s: FeedProjectionType["sizes"][number]) => React.ReactNode, cls = "") => {
    const s = t.sizes.find((x) => x.unitKg === u);
    return (
      <td key={u} className={`py-2 px-2 text-right border-l ${cls}`}>
        {s ? val(s) : "—"}
      </td>
    );
  };

  const totalFor = (u: number, val: (s: FeedProjectionType["sizes"][number]) => number) =>
    types.reduce((sum, t) => {
      const s = t.sizes.find((x) => x.unitKg === u);
      return sum + (s ? val(s) : 0);
    }, 0);

  const sizeSubHeads = () =>
    sizeUnits.map((u) => (
      <th key={u} className="py-1 px-2 font-normal text-right border-l">
        {u}kg
      </th>
    ));

  const money = (v: number) => `ZMW ${v.toLocaleString()}`;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-3 font-medium align-bottom" rowSpan={2}>
              Stage
            </th>
            <th className="px-2 font-medium text-center border-l" colSpan={n}>
              Required
            </th>
            <th className="px-2 font-medium text-center border-l" colSpan={n}>
              Purchased
            </th>
            <th className="px-2 font-medium text-center border-l" colSpan={n}>
              Remaining
            </th>
            <th className="px-2 font-medium text-center border-l" colSpan={n}>
              Proj. Cost
            </th>
            <th className="py-2 pl-3 font-medium align-bottom" rowSpan={2}>
              Status
            </th>
            {onPurchase && <th className="py-2 pl-2 font-medium align-bottom" rowSpan={2} />}
          </tr>
          <tr className="border-b text-muted-foreground">
            {sizeSubHeads()}
            {sizeSubHeads()}
            {sizeSubHeads()}
            {sizeSubHeads()}
          </tr>
        </thead>
        <tbody>
          {types.map((t) => {
            const pct = Math.round(t.coveragePct);
            const over = t.overPurchasedKg > 0;
            return (
              <tr key={t.typeName} className="border-b last:border-0 align-top">
                <td className="py-2 pr-3">
                  <div className="font-medium">{t.typeName}</div>
                  <div className="text-muted-foreground text-xs">
                    {t.dayRangeStart != null ? `Day ${t.dayRangeStart}${t.dayRangeEnd != null ? `–${t.dayRangeEnd}` : "+"}` : "—"}
                  </div>
                </td>
                {sizeUnits.map((u) => cell(t, u, (s) => s.requiredBags, "font-medium"))}
                {sizeUnits.map((u) => cell(t, u, (s) => s.purchasedBags))}
                {sizeUnits.map((u) => cell(t, u, (s) => s.remainingBags, `font-medium ${over || t.remainingKg <= 0 ? "text-green-600" : "text-amber-600"}`))}
                {sizeUnits.map((u) => cell(t, u, (s) => s.projectedCostZmw.toLocaleString()))}
                <td className="py-2 pl-3 pr-1 min-w-[140px]">
                  <div className="relative h-5 w-full rounded bg-muted overflow-hidden">
                    <div
                      className={`h-full ${over || t.status === "complete" ? "bg-green-500" : t.status === "partial" ? "bg-amber-500" : "bg-muted-foreground/20"}`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold">
                      {pct}%
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
                    <div>
                      Spent {money(t.spentZmw)} · To go {money(t.remainingCostZmw)}
                    </div>
                    {over && (
                      <Badge variant="secondary" className="mt-0.5 text-[10px] px-1 py-0 h-4 bg-green-100 text-green-700 border-green-200">
                        over-purchased +{t.overPurchasedKg.toFixed(0)}kg
                      </Badge>
                    )}
                  </div>
                </td>
                {onPurchase && (
                  <td className="py-2 pl-2 align-top">
                    <Button size="sm" variant="ghost" onClick={() => onPurchase(t)}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Buy
                    </Button>
                  </td>
                )}
              </tr>
            );
          })}
          <tr className="border-t-2 font-semibold">
            <td className="py-2 pr-3">Totals</td>
            {sizeUnits.map((u) => (
              <td key={u} className="py-2 px-2 text-right border-l">{totalFor(u, (s) => s.requiredBags)}</td>
            ))}
            {sizeUnits.map((u) => (
              <td key={u} className="py-2 px-2 text-right border-l">{totalFor(u, (s) => s.purchasedBags)}</td>
            ))}
            {sizeUnits.map((u) => (
              <td key={u} className="py-2 px-2 text-right border-l">{totalFor(u, (s) => s.remainingBags)}</td>
            ))}
            {sizeUnits.map((u) => (
              <td key={u} className="py-2 px-2 text-right border-l">{totalFor(u, (s) => s.projectedCostZmw).toLocaleString()}</td>
            ))}
            <td className="py-2 pl-3 pr-1 min-w-[140px]">
              {(() => {
                const spent = types.reduce((s, t) => s + t.spentZmw, 0);
                const toGo = types.reduce((s, t) => s + t.remainingCostZmw, 0);
                const pct = projection.totals.requiredKg > 0
                  ? Math.round(Math.min(100, (projection.totals.purchasedKg / projection.totals.requiredKg) * 100))
                  : 0;
                return (
                  <>
                    <div className="relative h-5 w-full rounded bg-muted overflow-hidden">
                      <div className={`h-full ${pct >= 100 ? "bg-green-500" : pct > 0 ? "bg-amber-500" : "bg-muted-foreground/20"}`} style={{ width: `${Math.max(pct, 2)}%` }} />
                      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold">{pct}%</span>
                    </div>
                    <div className="mt-1 text-[11px] leading-snug text-muted-foreground font-normal">
                      Spent {money(spent)} · To go {money(toGo)}
                    </div>
                  </>
                );
              })()}
            </td>
            {onPurchase && <td />}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
