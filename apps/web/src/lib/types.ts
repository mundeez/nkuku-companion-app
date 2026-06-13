export interface Supplier {
  id: string;
  name: string;
  description?: string;
  chickenType?: string;
  isActive: boolean;
  isDefault: boolean;
  feedStages: FeedStage[];
}

export interface FeedStage {
  id: string;
  stageName: string;
  stageType: "feed" | "chick" | "medication" | "other";
  dayRangeStart?: number;
  dayRangeEnd?: number;
  unitSizeKg: number;
  unitPriceZmw: number;
  intakePerBirdKg: number;
  sortOrder: number;
}

export interface Batch {
  id: string;
  cycleId: string;
  supplierId: string;
  shootLabel: string;
  targetExecutionDt: string;
  salesDate: string;
  growthQtyAdded: number;
  totalQtyAtHand: number;
  revenueTargetZmw?: number;
  salesPricePerBird?: number;
  status: string;
}

export interface ProjectionResult {
  supplierName: string;
  birdCount: number;
  effectiveBirdCount: string;
  mortalityPct: string;
  breakdown: Array<{
    stageName: string;
    stageType: string;
    itemsRaw: string | null;
    itemsRoundedUp: number | null;
    unitPriceZmw: string;
    subtotalZmw: string;
  }>;
  totalFeedCost: string;
  totalChickCost: string;
  totalOverheadCost: string;
  totalExpenses: string;
  projectedRevenue: string;
  grossProfit: string;
  netProfit: string;
  calculatedAt: string;
}

export interface ProductionCycle {
  id: string;
  cycleNumber: number;
  label?: string;
  status: string;
  batches: Batch[];
}

