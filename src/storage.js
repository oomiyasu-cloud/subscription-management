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
    purchases: Array.isArray(parsed.purchases) ? parsed.purchases : fallback.purchases,
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
