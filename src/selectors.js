import { judgeDeal, median } from "./calculations.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function getProductSummaries(state) {
  return state.products.map((product) => {
    const purchases = purchasesForProduct(state, product.id);
    const sorted = sortPurchasesDesc(purchases);
    const latest = sorted[0] ?? null;
    const comparable = latest ? comparablePurchases(purchases, latest.normalizedUnit) : [];
    const historyPrices = latest ? comparableHistoryPrices(comparable, latest.id) : [];
    const replenishment = latest ? estimateReplenishment(comparable) : { intervalDays: null, nextPurchaseDate: null };
    const unitPrices = comparable.map((purchase) => purchase.unitPrice);

    return {
      productId: product.id,
      name: product.name,
      category: product.category,
      latestPurchasedAt: latest?.purchasedAt ?? null,
      latestUnitPrice: latest?.unitPrice ?? null,
      latestDeal: latest ? judgeDeal(latest.unitPrice, historyPrices) : "first",
      bestUnitPrice: unitPrices.length ? Math.min(...unitPrices) : null,
      medianUnitPrice: unitPrices.length ? median(unitPrices) : null,
      averageUnitPrice: unitPrices.length ? average(unitPrices) : null,
      averagePurchaseIntervalDays: replenishment.intervalDays,
      nextPurchaseDate: replenishment.nextPurchaseDate,
      purchaseCount: purchases.length,
    };
  });
}

export function getDashboardData(state, today = todayString()) {
  const summaries = getProductSummaries(state);

  return {
    groupedSummaries: groupSummariesByCategory(summaries, today),
  };
}

export function getProductDetail(state, productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) {
    return null;
  }

  const purchases = sortPurchasesDesc(purchasesForProduct(state, productId));
  const latest = purchases[0] ?? null;
  const comparable = latest ? comparablePurchases(purchases, latest.normalizedUnit) : purchases;
  const historyPrices = latest ? comparableHistoryPrices(comparable, latest.id) : [];
  const replenishment = latest ? estimateReplenishment(comparable) : { intervalDays: null, nextPurchaseDate: null };
  const unitPrices = comparable.map((purchase) => purchase.unitPrice);

  return {
    product,
    purchases,
    latestUnitPrice: latest?.unitPrice ?? null,
    latestDeal: latest ? judgeDeal(latest.unitPrice, historyPrices) : "first",
    bestUnitPrice: unitPrices.length ? Math.min(...unitPrices) : null,
    medianUnitPrice: unitPrices.length ? median(unitPrices) : null,
    averageUnitPrice: unitPrices.length ? average(unitPrices) : null,
    averagePurchaseIntervalDays: replenishment.intervalDays,
    nextPurchaseDate: replenishment.nextPurchaseDate,
    purchaseCount: purchases.length,
  };
}

function purchasesForProduct(state, productId) {
  return state.purchases.filter((purchase) => purchase.productId === productId);
}

function sortPurchasesDesc(purchases) {
  return [...purchases].sort((left, right) => comparePurchaseOrder(right, left));
}

function comparablePurchases(purchases, normalizedUnit) {
  return purchases.filter((purchase) => purchase.normalizedUnit === normalizedUnit);
}

function comparableHistoryPrices(purchases, latestId) {
  return purchases.filter((purchase) => purchase.id !== latestId).map((purchase) => purchase.unitPrice);
}

function estimateReplenishment(purchases) {
  const sorted = sortPurchasesAsc(purchases).filter(
    (purchase) => normalizedPurchaseQuantity(purchase) > 0 && purchase.purchasedAt
  );
  if (sorted.length < 2) {
    return { intervalDays: null, nextPurchaseDate: null };
  }

  const dailyUsages = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    const days = daysBetween(previous.purchasedAt, current.purchasedAt);
    if (days > 0) {
      dailyUsages.push(normalizedPurchaseQuantity(previous) / days);
    }
  }

  if (dailyUsages.length === 0) {
    return { intervalDays: null, nextPurchaseDate: null };
  }

  const latest = sorted.at(-1);
  const averageDailyUsage = average(dailyUsages);
  const intervalDays = Math.round(normalizedPurchaseQuantity(latest) / averageDailyUsage);

  return {
    intervalDays,
    nextPurchaseDate: addDays(latest.purchasedAt, intervalDays),
  };
}

function normalizedPurchaseQuantity(purchase) {
  return Number(purchase.normalizedQuantity ?? purchase.quantity ?? 0);
}

function groupSummariesByCategory(summaries, today) {
  const groups = new Map();
  summaries.forEach((summary) => {
    const category = summary.category || "日用品";
    groups.set(category, [...(groups.get(category) ?? []), summary]);
  });

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "ja"))
    .map(([category, items]) => ({
      category,
      items: items
        .map((item) => ({ ...item, scheduleStatus: scheduleStatus(item.nextPurchaseDate, today) }))
        .sort(compareSummaryForDashboard),
    }));
}

function compareSummaryForDashboard(left, right) {
  const statusOrder = { overdue: 0, dueSoon: 1, normal: 2, none: 3 };
  const statusComparison = statusOrder[left.scheduleStatus] - statusOrder[right.scheduleStatus];
  if (statusComparison !== 0) {
    return statusComparison;
  }

  return String(left.name).localeCompare(String(right.name), "ja");
}

function scheduleStatus(nextPurchaseDate, today) {
  if (nextPurchaseDate === null) {
    return "none";
  }

  if (isOverdue(nextPurchaseDate, today)) {
    return "overdue";
  }

  if (isDueSoon(nextPurchaseDate, today)) {
    return "dueSoon";
  }

  return "normal";
}

function average(values) {
  if (values.length === 0) {
    return null;
  }

  return Number((values.reduce((sum, value) => sum + Number(value), 0) / values.length).toFixed(4));
}

function sortPurchasesAsc(purchases) {
  return [...purchases].sort(comparePurchaseOrder);
}

function daysBetween(fromDate, toDate) {
  const from = parseDateAtUTC(fromDate);
  const to = parseDateAtUTC(toDate);
  return Math.ceil((to - from) / DAY_MS);
}

function isDueSoon(nextPurchaseDate, today) {
  if (nextPurchaseDate === null) {
    return false;
  }

  const daysUntil = daysBetween(today, nextPurchaseDate);
  return daysUntil >= 0 && daysUntil <= 7;
}

function isOverdue(nextPurchaseDate, today) {
  if (nextPurchaseDate === null) {
    return false;
  }

  return compareDates(nextPurchaseDate, today) < 0;
}

function compareDates(left, right) {
  return String(left).localeCompare(String(right));
}

function addDays(dateString, days) {
  const timestamp = parseDateAtUTC(dateString) + days * DAY_MS;
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function comparePurchaseOrder(left, right) {
  const dateComparison = compareDates(left.purchasedAt, right.purchasedAt);
  if (dateComparison !== 0) {
    return dateComparison;
  }

  return String(left.createdAt ?? "").localeCompare(String(right.createdAt ?? ""));
}

function todayString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateAtUTC(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}
