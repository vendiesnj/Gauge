import { RuntimeUsageEvent, VendorCostInsight, VendorPlanInput } from "./types";
import { VENDOR_MAP } from "./vendors";

export function buildCostInsights(
  plans: VendorPlanInput[],
  runtimeEvents: RuntimeUsageEvent[],
): VendorCostInsight[] {
  return plans.map((plan) => {
    const vendor = VENDOR_MAP[plan.vendorId];
    const events = runtimeEvents.filter((e) => e.vendorId === plan.vendorId);
    const totalUsage = events.reduce((sum, e) => sum + e.usageQuantity, 0);
    const observedCost = events.reduce((sum, e) => sum + (e.costUsd ?? 0), 0);
    const monthlySpendUsd = plan.monthlySpendUsd ?? plan.monthlyCommitUsd ?? observedCost;
    const usageIncluded = plan.usageIncluded ?? 0;

    let estimatedUnusedSpendUsd = 0;
    const notes: string[] = [];

    if (usageIncluded > 0 && totalUsage < usageIncluded && monthlySpendUsd > 0) {
      const unusedRatio = 1 - totalUsage / usageIncluded;
      estimatedUnusedSpendUsd = Number((monthlySpendUsd * unusedRatio).toFixed(2));
      notes.push(`Observed usage is below included monthly capacity by about ${(unusedRatio * 100).toFixed(1)}%.`);
    }

    const alternative = vendor?.alternatives?.[0];
    const savingsPct = alternative?.estimatedSavingsPct ?? (vendor?.category === "ai" ? 15 : 8);
    const alternativeStackMonthlyUsd = monthlySpendUsd > 0
      ? Number((monthlySpendUsd * (1 - savingsPct / 100)).toFixed(2))
      : undefined;

    const savingsVsAlternativeUsd = alternativeStackMonthlyUsd !== undefined
      ? Number((monthlySpendUsd - alternativeStackMonthlyUsd).toFixed(2))
      : undefined;

    return {
      vendorId: plan.vendorId,
      vendorName: vendor?.name ?? plan.vendorId,
      monthlySpendUsd,
      estimatedUnusedSpendUsd,
      effectiveUnitCostUsd: totalUsage > 0 ? Number((monthlySpendUsd / totalUsage).toFixed(6)) : undefined,
      alternativeStackMonthlyUsd,
      savingsVsAlternativeUsd,
      savingsVsAlternativePct: savingsVsAlternativeUsd !== undefined && monthlySpendUsd > 0
        ? Number(((savingsVsAlternativeUsd / monthlySpendUsd) * 100).toFixed(2))
        : undefined,
      notes,
    };
  });
}
