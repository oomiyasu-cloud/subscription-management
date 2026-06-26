import { calculateUnitPrice, normalizeQuantity, toTaxIncludedPrice } from "./calculations.js";

function createTimestamp(now) {
  return now.toISOString();
}

function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const randomPart = Math.random().toString(36).slice(2, 10);
  return `local-${Date.now().toString(36)}-${randomPart}`;
}

function normalizeTaxRate(taxRate) {
  if (taxRate === undefined || taxRate === null) {
    return 0.1;
  }

  const trimmed = typeof taxRate === "string" ? taxRate.trim() : taxRate;
  if (trimmed === "") {
    return 0.1;
  }

  const numericTaxRate = Number(trimmed);
  return Number.isFinite(numericTaxRate) ? numericTaxRate : 0.1;
}

export function createProduct(input, now = new Date()) {
  const timestamp = createTimestamp(now);

  return {
    id: createId(),
    name: input.name.trim(),
    category: input.category.trim(),
    defaultUnit: input.defaultUnit,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createStore(name, now = new Date()) {
  const timestamp = createTimestamp(now);

  return {
    id: createId(),
    name: name.trim(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createPurchase(input, now = new Date()) {
  const timestamp = createTimestamp(now);
  const unitCount = normalizePositiveNumber(input.unitCount, 1);
  const isMultipack = input.isMultipack === true || input.isMultipack === "true" || input.isMultipack === "on";
  const packQuantity = isMultipack ? normalizePositiveNumber(input.packQuantity, 1) : 1;
  const packUnit = isMultipack ? String(input.packUnit || "個") : "";
  const normalized = normalizeQuantity(Number(input.quantity) * unitCount * packQuantity, input.unit);
  const taxRate = normalizeTaxRate(input.taxRate);
  const normalizedTaxIncludedPrice = toTaxIncludedPrice(
    Number(input.priceInput),
    input.taxMode,
    taxRate
  );

  return {
    id: createId(),
    productId: input.productId,
    purchasedAt: input.purchasedAt,
    storeId: input.storeId,
    quantity: Number(input.quantity),
    unit: input.unit,
    unitCount,
    isMultipack,
    packQuantity,
    packUnit,
    priceInput: Number(input.priceInput),
    taxMode: input.taxMode,
    taxRate,
    normalizedTaxIncludedPrice,
    normalizedQuantity: normalized.quantity,
    normalizedUnit: normalized.unit,
    unitKind: normalized.kind,
    unitPrice: calculateUnitPrice(normalizedTaxIncludedPrice, normalized.quantity),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updatePurchase(existingPurchase, input, now = new Date()) {
  const updated = createPurchase(input, now);

  return {
    ...updated,
    id: existingPurchase.id,
    createdAt: existingPurchase.createdAt,
    updatedAt: createTimestamp(now),
  };
}

function normalizePositiveNumber(value, fallback) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : fallback;
}
