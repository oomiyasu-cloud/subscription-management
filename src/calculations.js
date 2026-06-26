const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateAtUTC(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function formatDateUTC(timestamp) {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeQuantity(quantity, unit) {
  const numericQuantity = Number(quantity);
  const normalizedUnit = String(unit).trim();

  if (normalizedUnit === "L" || normalizedUnit === "l") {
    return { quantity: numericQuantity * 1000, unit: "ml", kind: "volume" };
  }

  if (normalizedUnit === "ml" || normalizedUnit === "mL") {
    return { quantity: numericQuantity, unit: "ml", kind: "volume" };
  }

  if (normalizedUnit === "kg") {
    return { quantity: numericQuantity * 1000, unit: "g", kind: "weight" };
  }

  if (normalizedUnit === "g") {
    return { quantity: numericQuantity, unit: "g", kind: "weight" };
  }

  if (normalizedUnit === "m") {
    return { quantity: numericQuantity * 100, unit: "cm", kind: "length" };
  }

  if (normalizedUnit === "cm") {
    return { quantity: numericQuantity, unit: "cm", kind: "length" };
  }

  return { quantity: numericQuantity, unit: normalizedUnit, kind: "count" };
}

export function toTaxIncludedPrice(price, taxMode, taxRate) {
  const numericPrice = Number(price);

  if (taxMode === "excluded") {
    return Math.round(numericPrice * (1 + Number(taxRate)));
  }

  return numericPrice;
}

export function calculateUnitPrice(price, quantity) {
  return Number((Number(price) / Number(quantity)).toFixed(4));
}

export function median(values) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return (sorted[middle - 1] + sorted[middle]) / 2;
}

export function judgeDeal(currentUnitPrice, historyUnitPrices) {
  const baseline = median(historyUnitPrices);

  if (baseline === null) {
    return "first";
  }

  if (currentUnitPrice < baseline * 0.9) {
    return "buy";
  }

  if (currentUnitPrice > baseline * 1.1) {
    return "high";
  }

  return "normal";
}

export function estimateNextPurchaseDate(purchaseDates) {
  if (purchaseDates.length === 0) {
    return null;
  }

  const sortedTimes = purchaseDates.map(parseDateAtUTC).sort((left, right) => left - right);
  const lastTime = sortedTimes.at(-1);

  if (sortedTimes.length === 1) {
    return formatDateUTC(lastTime + 30 * DAY_MS);
  }

  const intervals = [];
  for (let index = 1; index < sortedTimes.length; index += 1) {
    intervals.push((sortedTimes[index] - sortedTimes[index - 1]) / DAY_MS);
  }

  const averageDays = Math.round(intervals.reduce((sum, days) => sum + days, 0) / intervals.length);
  return formatDateUTC(lastTime + averageDays * DAY_MS);
}
