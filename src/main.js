import { createProduct, createPurchase, createStore, updatePurchase } from "./models.js?v=submit-fix-20260626";
import { backupFileName, createBackup, parseBackup } from "./backup.js?v=backup-20260626";
import { judgeDeal } from "./calculations.js";
import { getDashboardData, getProductDetail, getProductSummaries } from "./selectors.js";
import { cloudConfig } from "./cloudConfig.js";
import { createCloudClient } from "./cloudStorage.js";
import { loadState, saveState } from "./storage.js";
import { getPurchaseDraft, hasRequiredPurchaseNames, renderApp } from "./ui.js?v=home-search-20260629";

let state = loadState();
let route = { name: "dashboard", productId: null };
let pendingPurchase = null;
let purchaseFormDraft = null;
let editingPurchaseId = null;
const cloudClient = createCloudClient({ config: cloudConfig });
let cloudSession = cloudClient.getSession();
let cloudStatus = getInitialCloudStatus();
let isCloudSyncing = false;
let backupStatus = "";

function setRoute(nextRoute) {
  route = nextRoute;
  render();
}

function beginEditPurchase(purchaseId) {
  const purchase = state.purchases.find((item) => item.id === purchaseId);
  if (!purchase) {
    return false;
  }

  purchaseFormDraft = buildPurchaseFormDraft(purchase);
  editingPurchaseId = purchase.id;
  pendingPurchase = null;
  route = { name: "entry", productId: null };
  render();
  return true;
}

function deletePurchase(purchaseId) {
  const purchase = state.purchases.find((item) => item.id === purchaseId);
  if (!purchase) {
    return false;
  }

  if (typeof window !== "undefined" && typeof window.confirm === "function") {
    const confirmed = window.confirm("この購入履歴を削除しますか？");
    if (!confirmed) {
      return false;
    }
  }

  state = {
    ...state,
    purchases: state.purchases.filter((item) => item.id !== purchaseId),
  };
  persistState();

  if (editingPurchaseId === purchaseId) {
    editingPurchaseId = null;
    purchaseFormDraft = null;
  }

  if (pendingPurchase?.originalPurchaseId === purchaseId) {
    pendingPurchase = null;
  }

  render();
  return true;
}

function updateProduct(productId, input) {
  const name = String(input.name ?? "").trim();
  const category = String(input.category ?? "").trim() || "日用品";
  if (!name) {
    return false;
  }

  state = {
    ...state,
    products: state.products.map((product) =>
      product.id === productId ? { ...product, name, category, updatedAt: new Date().toISOString() } : product
    ),
  };
  persistState();
  render();
  return true;
}

function deleteProduct(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) {
    return false;
  }

  if (typeof window !== "undefined" && typeof window.confirm === "function") {
    const confirmed = window.confirm("この商品と関連する購入履歴を削除しますか？");
    if (!confirmed) {
      return false;
    }
  }

  state = {
    ...state,
    products: state.products.filter((item) => item.id !== productId),
    purchases: state.purchases.filter((item) => item.productId !== productId),
  };
  if (route.productId === productId) {
    route = { name: "products", productId: null };
  }
  persistState();
  render();
  return true;
}

function updateCategory(previousCategory, nextCategory) {
  const trimmedPrevious = String(previousCategory ?? "").trim();
  const trimmedNext = String(nextCategory ?? "").trim() || "日用品";
  if (!trimmedPrevious) {
    return false;
  }

  state = {
    ...state,
    products: state.products.map((product) =>
      product.category === trimmedPrevious
        ? { ...product, category: trimmedNext, updatedAt: new Date().toISOString() }
        : product
    ),
  };
  persistState();
  render();
  return true;
}

function deleteCategory(category) {
  const trimmedCategory = String(category ?? "").trim();
  if (!trimmedCategory) {
    return false;
  }

  if (typeof window !== "undefined" && typeof window.confirm === "function") {
    const confirmed = window.confirm("このカテゴリを削除し、対象商品を日用品に変更しますか？");
    if (!confirmed) {
      return false;
    }
  }

  return updateCategory(trimmedCategory, "日用品");
}

function updateStore(storeId, nameInput) {
  const name = String(nameInput ?? "").trim();
  if (!name) {
    return false;
  }

  state = {
    ...state,
    stores: state.stores.map((store) =>
      store.id === storeId ? { ...store, name, updatedAt: new Date().toISOString() } : store
    ),
  };
  persistState();
  render();
  return true;
}

function deleteStore(storeId) {
  const store = state.stores.find((item) => item.id === storeId);
  if (!store) {
    return false;
  }

  if (typeof window !== "undefined" && typeof window.confirm === "function") {
    const confirmed = window.confirm("この購入場所と関連する購入履歴を削除しますか？");
    if (!confirmed) {
      return false;
    }
  }

  state = {
    ...state,
    stores: state.stores.filter((item) => item.id !== storeId),
    purchases: state.purchases.filter((item) => item.storeId !== storeId),
  };
  persistState();
  render();
  return true;
}

function cancelEditingPurchase() {
  editingPurchaseId = null;
  pendingPurchase = null;
  purchaseFormDraft = null;
  route = { name: "entry", productId: null };
  render();
  return true;
}

function previewPurchase(formData) {
  const { productName, category, storeName } = getPurchaseDraft(formData);
  if (!hasRequiredPurchaseNames({ productName, storeName })) {
    return false;
  }

  const product = state.products.find((item) => item.name === productName);
  const store = state.stores.find((item) => item.name === storeName);
  const purchaseInput = buildPurchaseInput({
    formData,
    productId: product?.id ?? "__pending-product",
    storeId: store?.id ?? "__pending-store",
  });
  const purchase = createPurchase(purchaseInput);
  const deal = judgePurchaseDeal(purchase, editingPurchaseId);

  purchaseFormDraft = buildPurchaseFormDraftFromFormData(formData);

  pendingPurchase = {
    mode: editingPurchaseId ? "edit" : "create",
    originalPurchaseId: editingPurchaseId,
    productName,
    category,
    storeName,
    input: purchaseFormDraft,
    purchase: {
      ...purchase,
      productName,
      storeName,
      deal,
    },
    deal,
  };
  route = { name: "confirm", productId: null };
  render();
  return true;
}

function confirmPurchase() {
  if (!pendingPurchase) {
    return false;
  }

  const { productName, category, storeName, input, mode, originalPurchaseId } = pendingPurchase;
  let product = state.products.find((item) => item.name === productName);
  if (!product) {
    product = createProduct({ name: productName, category, defaultUnit: input.unit });
    state.products.push(product);
  } else if (product.category !== category) {
    product.category = category;
    product.updatedAt = new Date().toISOString();
  }

  let store = state.stores.find((item) => item.name === storeName);
  if (!store) {
    store = createStore(storeName);
    state.stores.push(store);
  }

  const purchaseInput = buildPurchaseInput({ formData: input, productId: product.id, storeId: store.id });
  const originalPurchase = mode === "edit" ? state.purchases.find((item) => item.id === originalPurchaseId) : null;
  const purchase = mode === "edit" && originalPurchase
    ? updatePurchase(originalPurchase, purchaseInput)
    : createPurchase(purchaseInput);

  if (mode === "edit" && originalPurchase) {
    state = {
      ...state,
      purchases: state.purchases.map((item) => (item.id === originalPurchase.id ? purchase : item)),
    };
  } else {
    state.purchases.push(purchase);
  }

  persistState();
  pendingPurchase = null;
  editingPurchaseId = null;
  purchaseFormDraft = null;
  route = { name: "dashboard", productId: null };
  render();
  return true;
}

function cancelPendingPurchase() {
  pendingPurchase = null;
  route = { name: "entry", productId: null };
  render();
}

async function signInCloud(email, password) {
  if (!cloudClient.isConfigured()) {
    cloudStatus = "クラウド設定が未完了です。src/cloudConfig.jsにSupabase情報を設定してください。";
    render();
    return false;
  }

  isCloudSyncing = true;
  cloudStatus = "ログイン中です。";
  render();

  try {
    cloudSession = await cloudClient.signIn(email.trim(), password);
    await syncFromCloud();
    route = { name: "dashboard", productId: null };
    render();
    return true;
  } catch (error) {
    cloudStatus = error.message || "ログインに失敗しました。";
    isCloudSyncing = false;
    render();
    return false;
  }
}

async function signUpCloud(email, password) {
  if (!cloudClient.isConfigured()) {
    cloudStatus = "クラウド設定が未完了です。src/cloudConfig.jsにSupabase情報を設定してください。";
    render();
    return false;
  }

  isCloudSyncing = true;
  cloudStatus = "アカウントを作成中です。";
  render();

  try {
    cloudSession = await cloudClient.signUp(email.trim(), password);
    if (cloudSession?.access_token) {
      await syncFromCloud();
      route = { name: "dashboard", productId: null };
    } else {
      cloudStatus = "確認メールが届いている場合は、確認後にログインしてください。";
    }
    isCloudSyncing = false;
    render();
    return true;
  } catch (error) {
    cloudStatus = error.message || "アカウント作成に失敗しました。";
    isCloudSyncing = false;
    render();
    return false;
  }
}

function signOutCloud() {
  cloudClient.signOut();
  cloudSession = null;
  isCloudSyncing = false;
  cloudStatus = "ログアウトしました。端末内のデータはそのまま使えます。";
  render();
  return true;
}

function exportBackup() {
  try {
    if (typeof Blob === "undefined" || typeof URL === "undefined" || typeof document === "undefined") {
      throw new Error("この環境ではバックアップを書き出せません。");
    }

    const backup = createBackup(state);
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = backupFileName(new Date(backup.exportedAt));
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    backupStatus = "バックアップを書き出しました。";
    render();
    return true;
  } catch (error) {
    backupStatus = error.message || "バックアップを書き出せませんでした。";
    render();
    return false;
  }
}

async function importBackup(file) {
  if (!file) {
    return false;
  }

  if (typeof window !== "undefined" && typeof window.confirm === "function") {
    const confirmed = window.confirm("現在のデータをバックアップファイルの内容に置き換えますか？");
    if (!confirmed) {
      backupStatus = "バックアップの読み込みをキャンセルしました。";
      render();
      return false;
    }
  }

  try {
    const text = await readBackupFile(file);
    state = parseBackup(text);
    pendingPurchase = null;
    editingPurchaseId = null;
    purchaseFormDraft = null;
    route = { name: "dashboard", productId: null };
    saveState(state);
    persistState();
    backupStatus = "バックアップを読み込みました。";
    render();
    return true;
  } catch (error) {
    backupStatus = error.message || "バックアップを読み込めませんでした。";
    render();
    return false;
  }
}

async function syncFromCloud() {
  if (!cloudClient.isConfigured() || !cloudSession) {
    return false;
  }

  isCloudSyncing = true;
  cloudStatus = "クラウドから読み込み中です。";
  render();

  try {
    const remoteState = await cloudClient.loadState(cloudSession);
    if (remoteState) {
      state = remoteState;
      saveState(state);
      cloudStatus = "クラウドのデータを読み込みました。";
    } else {
      await cloudClient.saveState(cloudSession, state);
      cloudStatus = "この端末のデータをクラウドに保存しました。";
    }
    return true;
  } catch (error) {
    cloudStatus = error.message || "クラウド同期に失敗しました。";
    return false;
  } finally {
    isCloudSyncing = false;
    render();
  }
}

function persistState() {
  saveState(state);

  if (!cloudClient.isConfigured() || !cloudSession) {
    return;
  }

  isCloudSyncing = true;
  cloudStatus = "クラウドへ保存中です。";
  render();

  cloudClient
    .saveState(cloudSession, state)
    .then(() => {
      cloudStatus = "クラウドへ保存しました。";
    })
    .catch((error) => {
      cloudStatus = error.message || "クラウド保存に失敗しました。";
    })
    .finally(() => {
      isCloudSyncing = false;
      render();
    });
}

function render() {
  renderApp({
    state,
    route,
    dashboard: getDashboardData(state),
    summaries: getProductSummaries(state),
    detail: route.productId ? getProductDetail(state, route.productId) : null,
    pendingPurchase,
    formDraft: purchaseFormDraft,
    editingPurchaseId,
    cloud: {
      isConfigured: cloudClient.isConfigured(),
      session: cloudSession,
      status: cloudStatus,
      isSyncing: isCloudSyncing,
    },
    backupStatus,
    actions: {
      setRoute,
      previewPurchase,
      confirmPurchase,
      cancelPendingPurchase,
      editPurchase: beginEditPurchase,
      deletePurchase,
      cancelEditingPurchase,
      updateProduct,
      deleteProduct,
      updateCategory,
      deleteCategory,
      updateStore,
      deleteStore,
      signInCloud,
      signUpCloud,
      signOutCloud,
      exportBackup,
      importBackup,
    },
  });
}

render();
syncFromCloud();
registerServiceWorker();

function getInitialCloudStatus() {
  if (!cloudClient.isConfigured()) {
    return "端末内に保存しています。";
  }

  return cloudSession ? "ログイン済みです。同期を準備しています。" : "ログインするとクラウド保存できます。";
}

function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

function readBackupFile(file) {
  return readJsonFile(file, "バックアップファイルを読み込めませんでした。");
}

function readJsonFile(file, errorMessage) {
  if (typeof file.text === "function") {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    if (typeof FileReader === "undefined") {
      reject(new Error(errorMessage));
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(new Error(errorMessage)));
    reader.readAsText(file);
  });
}

function buildPurchaseInput({ formData, productId, storeId }) {
  const getValue = (name) =>
    typeof FormData !== "undefined" && formData instanceof FormData ? formData.get(name) : formData[name];

  return {
    productId,
    purchasedAt: getValue("purchasedAt"),
    storeId,
    purchaseUrl: getValue("purchaseUrl"),
    quantity: getValue("quantity"),
    unit: getValue("unit"),
    unitCount: getValue("unitCount"),
    isMultipack: getValue("isMultipack"),
    packQuantity: getValue("packQuantity"),
    packUnit: getValue("packUnit"),
    priceInput: getValue("priceInput"),
    taxMode: getValue("taxMode"),
    taxRate: state.settings.taxRate,
  };
}

function judgePurchaseDeal(purchase) {
  if (purchase.productId === "__pending-product") {
    return "first";
  }

  const historyPrices = state.purchases
    .filter(
      (item) =>
        item.productId === purchase.productId &&
        item.normalizedUnit === purchase.normalizedUnit &&
        item.id !== editingPurchaseId
    )
    .map((item) => item.unitPrice);

  return judgeDeal(purchase.unitPrice, historyPrices);
}

function buildPurchaseFormDraft(purchase) {
  const product = state.products.find((item) => item.id === purchase.productId);
  const store = state.stores.find((item) => item.id === purchase.storeId);

  return {
    productName: product?.name ?? purchase.productName ?? "",
    category: product?.category ?? "",
    quantity: String(purchase.quantity ?? ""),
    unit: purchase.unit ?? product?.defaultUnit ?? "ml",
    unitCount: String(purchase.unitCount ?? 1),
    isMultipack: purchase.isMultipack ? "on" : "",
    packQuantity: String(purchase.packQuantity ?? 1),
    packUnit: purchase.packUnit ?? "個",
    priceInput: String(purchase.priceInput ?? purchase.normalizedTaxIncludedPrice ?? ""),
    taxMode: purchase.taxMode ?? "included",
    purchasedAt: purchase.purchasedAt ?? "",
    storeName: store?.name ?? purchase.storeName ?? "",
    purchaseUrl: purchase.purchaseUrl ?? "",
  };
}

function buildPurchaseFormDraftFromFormData(formData) {
  if (!(typeof FormData !== "undefined" && formData instanceof FormData)) {
    return { ...formData };
  }

  return Object.fromEntries(formData);
}
