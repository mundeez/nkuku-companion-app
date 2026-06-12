import Decimal from 'decimal.js';

export interface FeedStageInput {
  stageName: string;
  stageType: 'feed' | 'chick' | 'medication' | 'other';
  unitSizeKg: Decimal.Value;
  unitPriceZmw: Decimal.Value;
  intakePerBirdKg: Decimal.Value;
}

export interface ItemsRequiredResult {
  itemsRaw: string | null;
  itemsRoundedUp: number | null;
  error: string | null;
}

export interface StageSubtotalResult {
  subtotalZmw: string;
}

export interface ProjectionBreakdownItem {
  stageName: string;
  stageType: string;
  itemsRaw: string | null;
  itemsRoundedUp: number | null;
  unitPriceZmw: string;
  subtotalZmw: string;
}

export interface BatchProjectionResult {
  birdCount: number;
  effectiveBirdCount: string;
  mortalityPct: string;
  breakdown: ProjectionBreakdownItem[];
  totalFeedCost: string;
  totalChickCost: string;
  totalOverheadCost: string;
  totalExpenses: string;
  projectedRevenue: string;
  grossProfit: string;
  netProfit: string;
  calculatedAt: string;
}

// ──────────────────────────────────────────
// 1. Items Required (Rounded-Up)
// ──────────────────────────────────────────
export function calculateItemsRequired(
  birdCount: number,
  intakePerBirdKg: Decimal.Value,
  unitSizeKg: Decimal.Value,
): ItemsRequiredResult {
  if (birdCount <= 0) {
    return { itemsRaw: null, itemsRoundedUp: null, error: 'BIRD_COUNT_MUST_BE_POSITIVE' };
  }
  const intake = new Decimal(intakePerBirdKg);
  const unit = new Decimal(unitSizeKg);
  if (intake.lessThanOrEqualTo(0) || unit.lessThanOrEqualTo(0)) {
    return { itemsRaw: null, itemsRoundedUp: null, error: 'INVALID_INTAKE_OR_UNIT' };
  }

  const itemsRaw = new Decimal(birdCount).mul(intake).div(unit);
  const itemsRoundedUp = itemsRaw.ceil();

  return {
    itemsRaw: itemsRaw.toString(),
    itemsRoundedUp: itemsRoundedUp.toNumber(),
    error: null,
  };
}

// ──────────────────────────────────────────
// 2. Subtotal for a single stage
// ──────────────────────────────────────────
export function calculateStageSubtotal(
  unitPriceZmw: Decimal.Value,
  itemsRoundedUp: number,
): StageSubtotalResult {
  const price = new Decimal(unitPriceZmw);
  const qty = new Decimal(itemsRoundedUp);
  return { subtotalZmw: price.mul(qty).toFixed(2) };
}

// ──────────────────────────────────────────
// 3. Full Batch Projection
// ──────────────────────────────────────────
export function calculateBatchProjection(
  birdCount: number,
  feedStages: FeedStageInput[],
  salesPricePerBird: Decimal.Value,
  mortalityPct: Decimal.Value,
  overheadCosts: Decimal.Value[],
): BatchProjectionResult {
  if (birdCount <= 0) {
    throw new Error('BIRD_COUNT_MUST_BE_POSITIVE');
  }
  if (!feedStages || feedStages.length === 0) {
    throw new Error('FEED_STAGES_REQUIRED');
  }

  const mortality = new Decimal(mortalityPct);
  const effectiveBirdCount = new Decimal(birdCount).mul(
    new Decimal(1).minus(mortality),
  );

  let totalFeedCost = new Decimal(0);
  let totalChickCost = new Decimal(0);
  const breakdown: ProjectionBreakdownItem[] = [];

  for (const stage of feedStages) {
    const { itemsRaw, itemsRoundedUp, error } = calculateItemsRequired(
      birdCount,
      stage.intakePerBirdKg,
      stage.unitSizeKg,
    );

    let subtotalZmw = '0.00';
    if (itemsRoundedUp !== null) {
      subtotalZmw = calculateStageSubtotal(stage.unitPriceZmw, itemsRoundedUp).subtotalZmw;
    }

    breakdown.push({
      stageName: stage.stageName,
      stageType: stage.stageType,
      itemsRaw,
      itemsRoundedUp,
      unitPriceZmw: new Decimal(stage.unitPriceZmw).toFixed(2),
      subtotalZmw,
    });

    if (itemsRoundedUp !== null) {
      if (stage.stageType === 'chick') {
        totalChickCost = totalChickCost.plus(subtotalZmw);
      } else {
        totalFeedCost = totalFeedCost.plus(subtotalZmw);
      }
    }
  }

  const totalOverheadCost = overheadCosts.reduce(
    (sum, cost) => sum.plus(cost),
    new Decimal(0),
  );

  const totalExpenses = totalFeedCost.plus(totalChickCost).plus(totalOverheadCost);
  const projectedRevenue = effectiveBirdCount.mul(salesPricePerBird);
  const grossProfit = projectedRevenue.minus(totalFeedCost).minus(totalChickCost);
  const netProfit = projectedRevenue.minus(totalExpenses);

  return {
    birdCount,
    effectiveBirdCount: effectiveBirdCount.toFixed(2),
    mortalityPct: mortality.toFixed(4),
    breakdown,
    totalFeedCost: totalFeedCost.toFixed(2),
    totalChickCost: totalChickCost.toFixed(2),
    totalOverheadCost: totalOverheadCost.toFixed(2),
    totalExpenses: totalExpenses.toFixed(2),
    projectedRevenue: projectedRevenue.toFixed(2),
    grossProfit: grossProfit.toFixed(2),
    netProfit: netProfit.toFixed(2),
    calculatedAt: new Date().toISOString(),
  };
}

