export interface User {
  id: string;
  email: string;
  name: string | null;
  role: "owner" | "manager" | "flock_minder" | "sales_person" | "viewer";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  organizationId?: string;
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
  unitSizeKg: number | string;
  unitPriceZmw: number | string;
  intakePerBirdKg: number | string;
  sortOrder: number;
}

export interface FeedStagePriceHistory {
  id: string;
  feedStageId: string;
  stageName: string;
  oldUnitPriceZmw: number;
  newUnitPriceZmw: number;
  oldUnitSizeKg: number;
  newUnitSizeKg: number;
  changedBy?: string | null;
  changedAt: string;
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
  bagSize?: number | null;
  birdCount: number;
  effectiveBirdCount: string;
  mortalityPct: string;
  breakdown: Array<{
    stageName: string;
    stageType: string;
    unitSizeKg: string;
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
  supplierId?: string;
  supplier?: Supplier;
  orderDate?: string;
  startDate?: string | null;
  initialCount: number;
  currentCount: number;
  totalMortality?: number;
  mortalityRate?: number;
  targetWeight?: number;
  targetAge?: number;
  feedTransitionDay?: number;
  finisherDay?: number;
  chickPriceZmw?: number;
  salePriceZmw?: number | null;
  totalCost?: number;
  totalRevenue?: number;
  projectedRevenue?: number;
  projectedProfit?: number;
  housingType: "whole_house" | "spot_brooding";
  chicksCollected: boolean;
  collectionDate?: string;
  expectedCollectionStart?: string | null;
  expectedCollectionEnd?: string | null;
  chickQualityNotes?: string;
  status: "active" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
  financialRecords?: { amountZmw: number; isIncome: boolean; category: FinancialCategory }[];
  feedProjection?: FeedProjectionStageSummary[];
}

export interface FeedProjectionStageSummary {
  feedStageId: string;
  stageName: string;
  bagsRequired: number;
  bagsPurchased: number;
  bagsRemaining: number;
  status: "complete" | "partial" | "not_started";
}

export interface FeedProjectionStage extends FeedProjectionStageSummary {
  dayRangeStart: number | null;
  dayRangeEnd: number | null;
  bagSizeKg: number;
  intakePerBirdKg: number;
  birdsAliveAtStageStart: number;
  bagsRaw: string | null;
  unitPriceZmw: number;
  projectedCostZmw: number;
  purchasedCostZmw: number;
}

export interface FeedProjectionResult {
  flockId: string;
  flockName: string;
  initialCount: number;
  currentCount: number;
  supplierName: string | null;
  stages: FeedProjectionStage[];
  totals: {
    bagsRequired: number;
    bagsPurchased: number;
    bagsRemaining: number;
    projectedCostZmw: number;
    purchasedCostZmw: number;
  };
}

export interface FeedPurchase {
  id: string;
  organizationId: string;
  flockId: string;
  feedStageId?: string | null;
  supplierId?: string | null;
  purchaseDate: string;
  stageName: string;
  bagSizeKg: number;
  bagsPurchased: number;
  unitPriceZmw: number;
  totalCostZmw: number;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  feedStage?: { stageName: string; unitSizeKg: number } | null;
  supplier?: { name: string } | null;
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
  feedType: string;
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
  batchNumber?: string;
  expiryDate?: string;
  vaccineInventoryId?: string;
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

export interface FinancialRecordSummary {
  totalCost: number;
  totalRevenue: number;
  profit: number;
  profitPerBird: number;
  categoryBreakdown: Array<{ category: string; _sum: { amountZmw: number } }>;
  currentCount: number;
  initialCount: number;
  salePriceZmw: number | null;
  totalMortality: number;
  projectedRevenue: number;
  projectedProfit: number;
  projectedProfitPerBird: number;
}

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
  | "financial"
  | "medication_due"
  | "withdrawal_due"
  | "vaccine_expiry"
  | "environmental_threshold"
  | "task_due";

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

export interface MedicationRecord {
  id: string;
  flockId: string;
  recordDate: string;
  productName: string;
  category: MedicationCategory;
  dose?: string;
  route?: string;
  startDate: string;
  endDate?: string;
  withdrawalDays?: number;
  withdrawalDate?: string;
  costZmw?: number;
  veterinarian?: string;
  notes?: string;
}

export type MedicationCategory =
  | "antibiotic"
  | "coccidiostat"
  | "electrolyte"
  | "vitamin"
  | "probiotic"
  | "acidifier"
  | "phytogenic"
  | "other";

export interface VaccineInventory {
  id: string;
  name: string;
  disease?: string;
  supplier?: string;
  batchNumber: string;
  quantityDoses: number;
  expiryDate: string;
  status: VaccineInventoryStatus;
  costZmw?: number;
  notes?: string;
}

export type VaccineInventoryStatus = "available" | "in_use" | "expired" | "depleted";

export interface EnvironmentalRecord {
  id: string;
  flockId: string;
  recordDate: string;
  timeOfDay?: string;
  temperatureC?: number;
  humidityPct?: number;
  ammoniaPpm?: number;
  lightHours?: number;
  litterScore?: number;
  ventilationNote?: string;
  notes?: string;
}

export interface FlockTask {
  id: string;
  flockId: string;
  taskDate: string;
  ageDays: number;
  category: FlockTaskCategory;
  title: string;
  description?: string;
  isCompleted: boolean;
  isSkipped: boolean;
  completedAt?: string;
  notes?: string;
}

export type FlockTaskCategory =
  | "vaccination"
  | "feed"
  | "water"
  | "environment"
  | "health"
  | "biosecurity"
  | "management";

export interface FlockTimelineEvent {
  ageDays: number;
  date: string;
  type: string;
  title: string;
  description?: string;
  completed: boolean;
}

export interface FlockCalendarDay {
  day: number;
  age: string;
  date: string;
  vaccines: VaccinationScheduleItem[];
  lightingTemperature?: LightingTemperatureScheduleItemData;
  feedPhase: string;
  managementTasks: string[];
  healthSupport: string;
}

export interface LightingTemperatureSchedule {
  id: string;
  name: string;
  description?: string;
  housingType: "whole_house" | "spot_brooding";
  breedId?: string;
  isDefault: boolean;
  items: LightingTemperatureScheduleItemData[];
}

export interface LightingTemperatureScheduleItemData {
  id: string;
  scheduleId: string;
  ageDays: number;
  lightHours?: number;
  darkHours?: number;
  lightIntensityLux?: number;
  darkIntensityLux?: number;
  targetTempC?: number;
  targetTempMinC?: number;
  targetTempMaxC?: number;
  targetRhMinPct?: number;
  targetRhMaxPct?: number;
  notes?: string;
}

export interface VaccinationScheduleItem {
  id: string;
  scheduleId: string;
  vaccineName: string;
  vaccineType: string;
  ageDays: number;
  adminMethod: string;
  sortOrder: number;
  notes?: string;
  completed?: boolean;
}

// ── Dashboard Summary ─────────────────────────
export interface DashboardKpis {
  activeFlocks: number;
  pendingFlocks: number;
  totalFlocks: number;
  totalBirds: number;
  mortalityRate: number;
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  profitPerBird: number;
  openAlerts: number;
}

export interface MonthlyTrendItem {
  month: string;
  revenue: number;
  cost: number;
}

export interface CostBreakdownItem {
  category: string;
  amount: number;
}

export interface FlockProfitabilityItem {
  flockId: string;
  flockName: string;
  breedName: string;
  ageDays: number;
  currentCount: number;
  mortalityRate: number;
  profit: number;
  revenue: number;
  cost: number;
  status: string;
}

export interface FlockMortalityComparisonItem {
  flockId: string;
  flockName: string;
  initialCount: number;
  currentCount: number;
  totalDeaths: number;
  mortalityRate: number;
}

export interface AlertsBySeverity {
  critical: number;
  warning: number;
  info: number;
}

export interface AlertsByTypeItem {
  type: string;
  count: number;
  severity: string;
}

export interface RecentAlertItem {
  id: string;
  title: string;
  severity: string;
  alertType: string;
  flockName: string;
  createdAt: string;
  dueDate: string;
}

export interface DashboardSummary {
  kpis: DashboardKpis;
  monthlyTrend: MonthlyTrendItem[];
  costBreakdown: CostBreakdownItem[];
  flockProfitability: FlockProfitabilityItem[];
  flockMortalityComparison: FlockMortalityComparisonItem[];
  alertsBySeverity: AlertsBySeverity;
  alertsByType: AlertsByTypeItem[];
  recentAlerts: RecentAlertItem[];
}

// ── SALE RECORDS ──────────────────────────────

export type PaymentStatus = "pending" | "partial" | "paid";

export interface SaleRecord {
  id: string;
  flockId: string;
  saleDate: string;
  customerName: string | null;
  customerPhone: string | null;
  birdCount: number;
  avgWeightKg: number | null;
  pricePerBirdZmw: number;
  totalAmountZmw: number;
  paymentStatus: PaymentStatus;
  amountPaidZmw: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  flock?: { name: string; breed?: { name: string } };
}

export interface SaleRecordSummary {
  totalBirdsSold: number;
  totalRevenue: number;
  totalPaid: number;
  outstanding: number;
  salesCount: number;
  paymentBreakdown: Array<{ paymentStatus: string; count: number; totalAmount: number }>;
}

export interface SalesDashboardSummary {
  totalRevenue: number;
  totalBirdsSold: number;
  totalPaid: number;
  outstanding: number;
  salesCount: number;
  avgPricePerBird: number;
  paymentBreakdown: { paymentStatus: string; count: number; totalAmount: number }[];
  topCustomers: { customerName: string | null; totalAmount: number; saleCount: number }[];
  dailySales: { date: string; birds: number; revenue: number }[];
}

// ── DOCUMENT RECORDS ───────────────────────────

export interface DocumentRecord {
  id: string;
  flockId: string | null;
  recordType: string;
  recordId: string | null;
  financialRecordId: string | null;
  journalEntryId: string | null;
  saleRecordId: string | null;
  fileName: string;
  mimeType: string;
  fileSizeKb: number;
  category: string;
  scanStatus: string;
  extractionStatus: string;
  uploadedBy: string | null;
  createdAt: string;
  downloadUrl?: string;
}
