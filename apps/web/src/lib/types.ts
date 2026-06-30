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
  supplierId?: string;
  supplier?: Supplier;
  startDate: string;
  initialCount: number;
  currentCount: number;
  targetWeight?: number;
  targetAge?: number;
  feedTransitionDay?: number;
  chickPriceZmw?: number;
  chicksCollected: boolean;
  collectionDate?: string;
  chickQualityNotes?: string;
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
  feedPhase: string;
  managementTasks: string[];
  healthSupport: string;
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
