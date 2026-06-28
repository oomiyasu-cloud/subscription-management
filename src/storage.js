import { calculateUnitPrice, normalizeQuantity } from "./calculations.js";

const STORAGE_KEY = "subscription-management:v1";

export function defaultState() {
  return {
    products: [],
    purchases: [],
    stores: [],
    settings: {
      taxRate: 0.1,
      defaultCurrency: "JPY",
    },
  };
}

export function loadState() {
  const fallback = defaultState();
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return fallback;
  }

  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

export function normalizeState(parsed) {
  const fallback = defaultState();

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return fallback;
  }

  const settings =
    parsed.settings && typeof parsed.settings === "object" && !Array.isArray(parsed.settings)
      ? {
          ...fallback.settings,
          ...parsed.settings,
        }
      : fallback.settings;

  return {
    products: Array.isArray(parsed.products) ? parsed.products : fallback.products,
    purchases: Array.isArray(parsed.purchases)
      ? parsed.purchases.map(normalizeStoredPurchase)
      : fallback.purchases,
    stores: Array.isArray(parsed.stores) ? parsed.stores : fallback.stores,
    settings,
  };
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState() {
  localStorage.removeItem(STORAGE_KEY);
}

function normalizeStoredPurchase(purchase) {
  if (!purchase || typeof purchase !== "object" || Array.isArray(purchase)) {
    return purchase;
  }

  const quantity = Number(purchase.quantity);
  const totalPrice = Number(purchase.normalizedTaxIncludedPrice ?? purchase.priceInput);

  if (!Number.isFinite(quantity) || quantity <= 0 || !purchase.unit) {
    return purchase;
  }

  const unitCount = normalizePositiveNumber(purchase.unitCount, 1);
  const isMultipack =
    purchase.isMultipack === true || purchase.isMultipack === "true" || purchase.isMultipack === "on";
  const packQuantity = isMultipack ? normalizePositiveNumber(purchase.packQuantity, 1) : 1;
  const stockQuantity = normalizeQuantity(quantity * unitCount * packQuantity, purchase.unit);
  const pricingQuantity = normalizeQuantity(quantity * packQuantity, purchase.unit);

  return {
    ...purchase,
    unitCount,
    isMultipack,
    packQuantity,
    normalizedQuantity: stockQuantity.quantity,
    normalizedUnit: stockQuantity.unit,
    unitKind: stockQuantity.kind,
    unitPrice: Number.isFinite(totalPrice)
      ? calculateUnitPrice(totalPrice, pricingQuantity.quantity)
      : purchase.unitPrice,
  };
}

function normalizePositiveNumber(value, fallback) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : fallback;
}
