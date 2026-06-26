import { estimateNextPurchaseDate, judgeDeal, median } from "./calculations.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function getProductSummaries(state) {
  return state.products.map((product) => {
    const purchases = purchasesForProduct(state, product.id);
    const sorted = sortPurchasesDesc(purchases);
    const latest = sorted[0] ?? null;
    const comparable = latest ? comparablePurchases(purchases, latest.normalizedUnit) : [];
    const historyPrices = latest ? comparableHistoryPrices(comparable, latest.id) : [];
    const dates = purchases.map((purchase) => purchase.purchasedAt);

    return {
      productId: product.id,
      name: product.name,
      category: product.category,
      latestPurchasedAt: latest?.purchasedAt ?? null,
      latestUnitPrice: latest?.unitPrice ?? null,
      latestDeal: latest ? judgeDeal(latest.unitPrice, historyPrices) : "first",
      bestUnitPrice: comparable.length ? Math.min(...comparable.map((purchase) => purchase.unitPrice)) : null,
      medianUnitPrice: comparable.length ? median(comparable.map((purchase) => purchase.unitPrice)) : null,
      averagePurchaseIntervalDays: averagePurchaseIntervalDays(dates),
      nextPurchaseDate: estimateNextPurchaseDate(dates),
    };
  });
}

export function getDashboardData(state, today = todayString()) {
  const summaries = getProductSummaries(state);
  const dueSoon = summaries
    .filter((summary) => isDueSoon(summary.nextPurchaseDate, today))
    .sort((left, right) => compareDates(left.nextPurchaseDate, right.nextPurchaseDate));
  const overdue = summaries
    .filter((summary) => isOverdue(summary.nextPurchaseDate, today))
    .sort((left, right) => compareDates(left.nextPurchaseDate, right.nextPurchaseDate));

  return {
    dueSoon,
    overdue,
    recentPurchases: sortPurchasesDesc(state.purchases).slice(0, 5),
    goodDeals: purchaseHighlights(state, "buy"),
    highPrices: purchaseHighlights(state, "high"),
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

  return {
    product,
    purchases,
    latestUnitPrice: latest?.unitPrice ?? null,
    latestDeal: latest ? judgeDeal(latest.unitPrice, historyPrices) : "first",
    bestUnitPrice: comparable.length ? Math.min(...comparable.map((purchase) => purchase.unitPrice)) : null,
    medianUnitPrice: comparable.length ? median(comparable.map((purchase) => purchase.unitPrice)) : null,
    averagePurchaseIntervalDays: averagePurchaseIntervalDays(purchases.map((purchase) => purchase.purchasedAt)),
    nextPurchaseDate: estimateNextPurchaseDate(purchases.map((purchase) => purchase.purchasedAt)),
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

function purchaseHighlights(state, dealType) {
  return sortPurchasesDesc(
    state.purchases.flatMap((purchase) => {
      const history = state.purchases
        .filter(
          (item) =>
            item.productId === purchase.productId &&
            item.normalizedUnit === purchase.normalizedUnit &&
            comparePurchaseOrder(item, purchase) < 0
        )
        .map((item) => item.unitPrice);
      const deal = judgeDeal(purchase.unitPrice, history);

      if (deal !== dealType) {
        return [];
      }

      return [{ ...purchase, deal }];
    })
  );
}

function averagePurchaseIntervalDays(purchaseDates) {
  if (purchaseDates.length < 2) {
    return null;
  }

  const sortedTimes = purchaseDates.map(parseDateAtUTC).sort((left, right) => left - right);
  const intervals = [];
  for (let index = 1; index < sortedTimes.length; index += 1) {
    intervals.push((sortedTimes[index] - sortedTimes[index - 1]) / DAY_MS);
  }

  return Math.round(intervals.reduce((sum, days) => sum + days, 0) / intervals.length);
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
