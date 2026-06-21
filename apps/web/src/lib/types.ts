export interface User {
  id: string;
  email: string;
  name: string | null;
  role: "owner" | "manager" | "viewer";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  description?: string;
  chickenType?: string;
  contact?: string;
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

export interface SupplierCategoryTemplate {
  id: string;
  category: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  items: SupplierCategoryTemplateItem[];
}

export interface SupplierCategoryTemplateItem {
  id: string;
  templateId: string;
  itemName: string;
  itemType: "feed" | "chick" | "medication" | "other";
  sortOrder: number;
  defaultFields?: Record<string, any>;
  isRequired: boolean;
  isActive: boolean;
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


// ── Broiler Management Types ────────────────────

export interface Breed {
  id: string;
  name: string;
  supplier: string;
  isPrimary: boolean;
  performanceTargets: PerformanceTarget[];
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceTarget {
  id: string;
  breedId: string;
  ageDays: number;
  targetWeight: number;
  targetFeed: number;
  targetFcr: number;
}

export interface BroilerFlock {
  id: string;
  name: string;
  breedId: string;
  breed: Breed;
  startDate: string;
  initialCount: number;
  currentCount: number;
  targetWeight?: number;
  targetAge?: number;
  feedTransitionDay?: number;
  status: "active" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
}

export interface GrowthRecord {
  id: string;
  flockId: string;
  recordDate: string;
  sampleSize: number;
  avgWeight: number;
  notes?: string;
}

export interface FeedRecord {
  id: string;
  flockId: string;
  supplierId?: string;
  recordDate: string;
  feedType: "starter" | "grower" | "finisher";
  feedBrand?: string;
  quantityKg: number;
  costZmw?: number;
  notes?: string;
  supplier?: { name: string };
}

export interface WaterRecord {
  id: string;
  flockId: string;
  recordDate: string;
  quantityLiters: number;
  ph?: number;
  temperature?: number;
  notes?: string;
}

export interface MortalityEvent {
  id: string;
  flockId: string;
  eventDate: string;
  count: number;
  cause?: string;
  ageDays?: number;
  notes?: string;
}

export interface VaccinationEvent {
  id: string;
  flockId: string;
  vaccineName: string;
  vaccineType: string;
  adminDate: string;
  adminMethod: string;
  ageDays: number;
  nextDueDate?: string;
  notes?: string;
}

export interface FinancialRecord {
  id: string;
  flockId: string;
  recordDate: string;
  category: FinancialCategory;
  description: string;
  amountZmw: number;
  isIncome: boolean;
  notes?: string;
}

export type FinancialCategory =
  | "chick_purchase"
  | "feed"
  | "vaccines"
  | "medication"
  | "labor"
  | "utilities"
  | "equipment"
  | "sales"
  | "other";

export interface Alert {
  id: string;
  flockId: string;
  flock?: { name: string };
  alertType: AlertType;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  dueDate: string;
  isRead: boolean;
  isResolved: boolean;
  createdAt: string;
}

export type AlertType =
  | "temperature_adjustment"
  | "vaccination_due"
  | "feed_transition"
  | "weight_check"
  | "mortality_threshold"
  | "environmental"
  | "financial";

export interface Disease {
  id: string;
  name: string;
  category: string;
  incubation?: string;
  mortalityRate?: string;
  symptoms?: string;
  prevention?: string;
  treatment?: string;
  organicTreatments?: string;
}
