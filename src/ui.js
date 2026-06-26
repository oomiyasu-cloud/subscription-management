const app = typeof document === "undefined" ? null : document.querySelector("#app");

export function renderApp(viewModel) {
  if (!app) {
    return;
  }

  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <h1 class="brand">定期購入管理</h1>
        <span class="data-count">${viewModel.state.purchases.length}件 / ${cloudLabel(viewModel.cloud)}</span>
      </header>
      <main class="content">${renderMain(viewModel)}</main>
      ${renderNav(viewModel.route.name)}
    </div>
  `;

  bindNavigation(viewModel.actions);
  bindForm(viewModel.actions);
  bindConfirmation(viewModel.actions);
  bindEditing(viewModel.actions);
  bindPurchaseActions(viewModel.actions);
  bindMasterManagement(viewModel.actions);
  bindCloudAccount(viewModel.actions);
  bindBackupActions(viewModel.actions);
  bindProductLinks(viewModel.actions);
}

function renderMain(viewModel) {
  if (viewModel.route.name === "entry") {
    return renderEntry(viewModel.state, viewModel.formDraft, viewModel.editingPurchaseId);
  }

  if (viewModel.route.name === "confirm") {
    return renderConfirm(viewModel.pendingPurchase, viewModel.state);
  }

  if (viewModel.route.name === "products") {
    return renderProducts(viewModel.summaries, viewModel.state);
  }

  if (viewModel.route.name === "detail") {
    return renderDetail(viewModel.detail, viewModel.state);
  }

  if (viewModel.route.name === "account") {
    return renderAccount(viewModel.cloud, viewModel.backupStatus);
  }

  return renderDashboard(viewModel.dashboard, viewModel.state);
}

function renderDashboard(dashboard, state) {
  return `
    <section class="view">
      <h2>ホーム</h2>
      ${renderList("期限切れ", dashboard.overdue, renderSummaryCard)}
      ${renderList("そろそろ買うもの", dashboard.dueSoon, renderSummaryCard)}
      ${renderList("最近の購入", dashboard.recentPurchases, (purchase) => renderPurchaseCard(purchase, state))}
      ${renderList("お買い得", dashboard.goodDeals, (purchase) => renderPurchaseCard(purchase, state))}
      ${renderList("高めだったもの", dashboard.highPrices, (purchase) => renderPurchaseCard(purchase, state))}
    </section>
  `;
}

function renderEntry(state, draft = {}, editingPurchaseId = null) {
  draft ??= {};
  const today = formatToday();
  const categories = getCategoryNames(state);
  const products = getProductNames(state);
  const stores = getStoreNames(state);
  const productDefaults = buildProductDefaults(state);
  const storeOptions = stores
    .map((storeName) => `<option value="${escapeHtml(storeName)}"></option>`)
    .join("");
  const productOptions = products
    .map((productName) => `<option value="${escapeHtml(productName)}"></option>`)
    .join("");
  const categoryOptions = categories
    .map((category) => `<option value="${escapeHtml(category)}"></option>`)
    .join("");
  const isEditing = Boolean(editingPurchaseId);

  return `
    <section class="view">
      <h2>${isEditing ? "購入編集" : "購入入力"}</h2>
      ${isEditing ? '<p class="edit-notice">過去の購入を編集中です。<button class="text-button" data-cancel-editing type="button">編集をやめる</button></p>' : ""}
      <form class="purchase-form" data-purchase-form data-product-defaults="${escapeHtml(JSON.stringify(productDefaults))}">
        <label>商品名を履歴から選択
          <select name="productHistorySelect" data-history-product-select>
            <option value="">選択してください</option>
            ${renderValueOptions(products, draft.productName ?? "")}
          </select>
        </label>
        <label>商品名<input name="productName" list="products" value="${escapeHtml(draft.productName ?? "")}" required /></label>
        <datalist id="products">${productOptions}</datalist>
        <label>カテゴリを履歴から選択
          <select name="categoryHistorySelect" data-history-category-select>
            <option value="">選択してください</option>
            ${renderValueOptions(categories, draft.category ?? "")}
          </select>
        </label>
        <label>カテゴリ<input name="category" list="categories" value="${escapeHtml(draft.category ?? "")}" placeholder="日用品" /></label>
        <datalist id="categories">${categoryOptions}</datalist>
        <div class="form-grid">
          <label>容量<input name="quantity" type="number" min="0.01" step="0.01" value="${escapeHtml(draft.quantity ?? "")}" required /></label>
          <label>単位
            <select name="unit">
              ${renderSelectOption("g", "g", draft.unit ?? "ml")}
              ${renderSelectOption("ml", "ml", draft.unit ?? "ml")}
              ${renderSelectOption("cm", "cm", draft.unit ?? "ml")}
              ${renderSelectOption("m", "m", draft.unit ?? "ml")}
              ${renderSelectOption("個", "個", draft.unit ?? "ml")}
              ${renderSelectOption("枚", "枚", draft.unit ?? "ml")}
            </select>
          </label>
        </div>
        <label class="toggle-field">
          <span>複数パック商品</span>
          <input name="isMultipack" type="checkbox" data-multipack-toggle ${isMultipackEnabled(draft) ? "checked" : ""} />
        </label>
        <div class="form-grid pack-fields" data-pack-fields ${isMultipackEnabled(draft) ? "" : "hidden"}>
          <label>パック数量<input name="packQuantity" type="number" min="1" step="1" value="${escapeHtml(draft.packQuantity ?? "1")}" /></label>
          <label>パック単位
            <select name="packUnit">
              ${renderSelectOption("個", "個", draft.packUnit ?? "個")}
              ${renderSelectOption("箱", "箱", draft.packUnit ?? "個")}
            </select>
          </label>
        </div>
        <div class="form-grid">
          <label>価格<input name="priceInput" type="number" min="1" step="1" value="${escapeHtml(draft.priceInput ?? "")}" required /></label>
          <label>税
            <select name="taxMode">
              ${renderSelectOption("included", "税込", draft.taxMode ?? "included")}
              ${renderSelectOption("excluded", "税抜", draft.taxMode ?? "included")}
            </select>
          </label>
        </div>
        <label>購入数<input name="unitCount" type="number" min="1" step="1" value="${escapeHtml(draft.unitCount ?? "1")}" required /></label>
        <label>購入日<input name="purchasedAt" type="date" value="${escapeHtml(draft.purchasedAt ?? today)}" required /></label>
        <label>購入場所を履歴から選択
          <select name="storeHistorySelect" data-history-store-select>
            <option value="">選択してください</option>
            ${renderValueOptions(stores, draft.storeName ?? "")}
          </select>
        </label>
        <label>購入場所<input name="storeName" list="stores" value="${escapeHtml(draft.storeName ?? "")}" required /></label>
        <datalist id="stores">${storeOptions}</datalist>
        <p class="form-error" data-form-error hidden></p>
        <button class="primary-button" data-purchase-submit type="submit">${isEditing ? "変更を確認" : "判定する"}</button>
      </form>
    </section>
  `;
}

function renderConfirm(pendingPurchase, state) {
  if (!pendingPurchase) {
    return `
      <section class="view">
        <h2>購入前確認</h2>
        <p class="empty">確認できる入力データがありません。</p>
        <button class="primary-button" data-route="entry" type="button">入力へ戻る</button>
      </section>
    `;
  }

  return `
    <section class="view">
      <h2>${pendingPurchase.mode === "edit" ? "変更前確認" : "購入前確認"}</h2>
      <div class="confirm-panel">
        <dl class="metrics">
          <div><dt>判定</dt><dd><span class="status status-${pendingPurchase.deal}">${dealLabel(pendingPurchase.deal)}</span></dd></div>
          <div><dt>単価</dt><dd>${formatUnitPrice(pendingPurchase.purchase.unitPrice)} / ${escapeHtml(pendingPurchase.purchase.normalizedUnit)}</dd></div>
          <div><dt>合計量</dt><dd>${formatQuantity(pendingPurchase.purchase.normalizedQuantity)}${escapeHtml(pendingPurchase.purchase.normalizedUnit)}</dd></div>
        </dl>
        ${renderPurchaseCard(pendingPurchase.purchase, state)}
      </div>
      <div class="confirmation-actions">
        <button class="primary-button" data-confirm-purchase type="button">${pendingPurchase.mode === "edit" ? "更新する" : "購入する"}</button>
        <button class="secondary-button" data-cancel-pending type="button">キャンセル</button>
      </div>
    </section>
  `;
}

function renderProducts(summaries, state) {
  return `
    <section class="view">
      <h2>商品</h2>
      ${
        summaries.length
          ? summaries.map(renderSummaryCard).join("")
          : '<p class="empty">購入を入力すると商品が表示されます。</p>'
      }
      ${renderMasterManagement(state)}
    </section>
  `;
}

function renderMasterManagement(state) {
  return `
    <section class="panel management-panel">
      <h3>商品管理</h3>
      ${state.products.length ? state.products.map(renderProductManageForm).join("") : '<p class="empty">商品はまだありません。</p>'}
    </section>
    <section class="panel management-panel">
      <h3>カテゴリ管理</h3>
      ${getCategoryNames(state).length ? getCategoryNames(state).map(renderCategoryManageForm).join("") : '<p class="empty">カテゴリはまだありません。</p>'}
    </section>
    <section class="panel management-panel">
      <h3>購入場所管理</h3>
      ${state.stores.length ? state.stores.map(renderStoreManageForm).join("") : '<p class="empty">購入場所はまだありません。</p>'}
    </section>
  `;
}

function renderProductManageForm(product) {
  return `
    <form class="manage-form" data-product-manage-form data-managed-product-id="${product.id}">
      <label>商品名<input name="name" value="${escapeHtml(product.name)}" required /></label>
      <label>カテゴリ<input name="category" value="${escapeHtml(product.category)}" required /></label>
      <div class="manage-actions">
        <button class="secondary-button compact-button" type="submit">変更</button>
        <button class="text-button danger-button" data-delete-product-id="${product.id}" type="button">削除</button>
      </div>
    </form>
  `;
}

function renderCategoryManageForm(category) {
  return `
    <form class="manage-form" data-category-manage-form data-category-name="${escapeHtml(category)}">
      <label>カテゴリ<input name="category" value="${escapeHtml(category)}" required /></label>
      <div class="manage-actions">
        <button class="secondary-button compact-button" type="submit">変更</button>
        <button class="text-button danger-button" data-delete-category-name="${escapeHtml(category)}" type="button">削除</button>
      </div>
    </form>
  `;
}

function renderStoreManageForm(store) {
  return `
    <form class="manage-form" data-store-manage-form data-store-id="${store.id}">
      <label>購入場所<input name="name" value="${escapeHtml(store.name)}" required /></label>
      <div class="manage-actions">
        <button class="secondary-button compact-button" type="submit">変更</button>
        <button class="text-button danger-button" data-delete-store-id="${store.id}" type="button">削除</button>
      </div>
    </form>
  `;
}

function renderAccount(cloud, backupStatus = "") {
  const session = cloud?.session ?? null;

  if (!cloud?.isConfigured) {
    return `
      <section class="view">
        <h2>保存</h2>
        <section class="panel account-panel">
          <p class="sync-status">${escapeHtml(cloud?.status ?? "端末内に保存しています。")}</p>
          <dl class="metrics">
            <div><dt>保存先</dt><dd>端末内</dd></div>
            <div><dt>状態</dt><dd>ローカル保存</dd></div>
          </dl>
        </section>
        ${renderBackupPanel(backupStatus)}
      </section>
    `;
  }

  return `
    <section class="view">
      <h2>ログイン・同期</h2>
      <section class="panel account-panel">
        <p class="sync-status">${escapeHtml(cloud?.status ?? "端末内に保存しています。")}</p>
        ${
          session
            ? `
              <dl class="metrics">
                <div><dt>ログイン中</dt><dd>${escapeHtml(session.user?.email ?? "アカウント")}</dd></div>
                <div><dt>保存先</dt><dd>クラウド</dd></div>
              </dl>
              <button class="secondary-button" data-cloud-sign-out type="button">ログアウト</button>
            `
            : `
              <form class="purchase-form" data-cloud-login-form>
                <label>メールアドレス<input name="email" type="email" autocomplete="email" required /></label>
                <label>パスワード<input name="password" type="password" autocomplete="current-password" required /></label>
                <div class="confirmation-actions">
                  <button class="primary-button" data-cloud-sign-in type="submit">ログイン</button>
                  <button class="secondary-button" data-cloud-sign-up type="button">新規登録</button>
                </div>
              </form>
            `
        }
      </section>
      ${renderBackupPanel(backupStatus)}
    </section>
  `;
}

function renderBackupPanel(backupStatus = "") {
  return `
    <section class="panel account-panel">
      <h3>バックアップ</h3>
      <p class="empty">端末内のデータをファイルに保存したり、保存済みファイルから戻したりできます。</p>
      <div class="backup-actions">
        <button class="secondary-button" data-export-backup type="button">バックアップを書き出す</button>
        <label class="file-button">
          バックアップを読み込む
          <input data-import-backup type="file" accept="application/json,.json" />
        </label>
      </div>
      ${backupStatus ? `<p class="sync-status">${escapeHtml(backupStatus)}</p>` : ""}
    </section>
  `;
}

function renderDetail(detail, state) {
  if (!detail) {
    return '<section class="view"><p class="empty">商品が見つかりません。</p></section>';
  }

  return `
    <section class="view">
      <button class="text-button" data-route="products" type="button">商品へ戻る</button>
      <h2>${escapeHtml(detail.product.name)}</h2>
      <p class="detail-subtitle">${escapeHtml(detail.product.category)}</p>
      <dl class="metrics">
        <div><dt>直近単価</dt><dd>${formatUnitPrice(detail.latestUnitPrice)}</dd></div>
        <div><dt>直近判定</dt><dd>${dealLabel(detail.latestDeal)}</dd></div>
        <div><dt>過去最安</dt><dd>${formatUnitPrice(detail.bestUnitPrice)}</dd></div>
        <div><dt>中央値</dt><dd>${formatUnitPrice(detail.medianUnitPrice)}</dd></div>
        <div><dt>平均間隔</dt><dd>${formatInterval(detail.averagePurchaseIntervalDays)}</dd></div>
        <div><dt>次回目安</dt><dd>${detail.nextPurchaseDate ?? "なし"}</dd></div>
      </dl>
      ${detail.purchases.length ? detail.purchases.map((purchase) => renderPurchaseCard(purchase, state, { showActions: true })).join("") : '<p class="empty">購入履歴はまだありません。</p>'}
    </section>
  `;
}

function renderNav(current) {
  return `
    <nav class="bottom-nav" aria-label="主要画面">
      <button class="nav-button" data-route="dashboard" aria-current="${current === "dashboard" ? "page" : "false"}" type="button">ホーム</button>
      <button class="nav-button" data-route="entry" aria-current="${current === "entry" ? "page" : "false"}" type="button">入力</button>
      <button class="nav-button" data-route="products" aria-current="${current === "products" ? "page" : "false"}" type="button">商品</button>
      <button class="nav-button" data-route="account" aria-current="${current === "account" ? "page" : "false"}" type="button">保存</button>
    </nav>
  `;
}

function renderList(title, items, renderer) {
  return `
    <section class="panel">
      <h3>${title}</h3>
      ${items.length ? items.map(renderer).join("") : '<p class="empty">まだありません。</p>'}
    </section>
  `;
}

function renderSummaryCard(summary) {
  return `
    <article class="item-card item-card-button" data-product-id="${summary.productId}" tabindex="0" role="button">
      <div class="summary-card-body">
        <strong>${escapeHtml(summary.name)}</strong>
        <p>${escapeHtml(summary.category)} / 次回 ${summary.nextPurchaseDate ?? "未定"}</p>
        <dl class="summary-metrics">
          <div><dt>最新</dt><dd>${summary.latestPurchasedAt ?? "なし"}</dd></div>
          <div><dt>直近</dt><dd>${formatUnitPrice(summary.latestUnitPrice)}</dd></div>
          <div><dt>最安</dt><dd>${formatUnitPrice(summary.bestUnitPrice)}</dd></div>
          <div><dt>間隔</dt><dd>${formatInterval(summary.averagePurchaseIntervalDays)}</dd></div>
        </dl>
      </div>
      <span class="status status-${summary.latestDeal}">${dealLabel(summary.latestDeal)}</span>
    </article>
  `;
}

function renderPurchaseCard(purchase, state, options = {}) {
  const card = getPurchaseCardView(purchase, state);
  const metaParts = [card.quantityLabel];
  if (card.storeName) {
    metaParts.push(card.storeName);
  }

  return `
    <article class="item-card purchase-card">
      <div class="purchase-card-main">
        <div class="purchase-card-heading">
          <strong>${escapeHtml(card.productName)}</strong>
          ${card.deal ? `<span class="status status-${card.deal}">${dealLabel(card.deal)}</span>` : ""}
        </div>
        <p>${purchase.purchasedAt} / ${metaParts.map(escapeHtml).join(" / ")}</p>
      </div>
      <div class="purchase-card-prices">
        <strong>${formatTotalPrice(card.totalPaid)}</strong>
        <p>${formatUnitPrice(card.unitPrice)} / ${escapeHtml(card.normalizedUnit)}</p>
      </div>
      ${
        options.showActions
          ? `
            <div class="purchase-card-actions">
              <button class="text-button" data-edit-purchase-id="${card.purchaseId}" type="button">編集</button>
              <button class="text-button danger-button" data-delete-purchase-id="${card.purchaseId}" type="button">削除</button>
            </div>
          `
          : ""
      }
    </article>
  `;
}

function bindNavigation(actions) {
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () =>
      actions.setRoute({ name: button.dataset.route, productId: null })
    );
  });
}

function bindForm(actions) {
  const form = document.querySelector("[data-purchase-form]");
  if (!form) {
    return;
  }

  const productInput = form.elements.namedItem("productName");
  const productHistorySelect = form.elements.namedItem("productHistorySelect");
  const categoryHistorySelect = form.elements.namedItem("categoryHistorySelect");
  const storeHistorySelect = form.elements.namedItem("storeHistorySelect");
  const quantityInput = form.elements.namedItem("quantity");
  const unitCountInput = form.elements.namedItem("unitCount");
  const priceInput = form.elements.namedItem("priceInput");
  const packQuantityInput = form.elements.namedItem("packQuantity");
  const storeInput = form.elements.namedItem("storeName");
  const multipackToggle = form.querySelector("[data-multipack-toggle]");
  const packFields = form.querySelector("[data-pack-fields]");
  const formError = form.querySelector("[data-form-error]");
  const submitButton = form.querySelector("[data-purchase-submit]");
  let isSubmittingPurchaseForm = false;
  const clearFormError = () => {
    if (!formError) {
      return;
    }

    formError.hidden = true;
    formError.textContent = "";
  };
  const syncTrimmedValidity = () => {
    const draft = getPurchaseDraft(readFormFields(form));
    setTrimmedRequiredValidity(productInput, draft.productName, "商品名を入力してください。");
    setTrimmedRequiredValidity(storeInput, draft.storeName, "購入場所を入力してください。");
  };
  const applyProductDefaults = () => {
    const defaults = getProductDefaults(form);
    const productDefault = defaults[String(productInput?.value ?? "").trim()];
    if (!productDefault) {
      return;
    }

    form.elements.category.value = productDefault.category;
    form.elements.quantity.value = productDefault.quantity;
    form.elements.unit.value = productDefault.unit;
    form.elements.isMultipack.checked = productDefault.isMultipack;
    form.elements.packQuantity.value = productDefault.packQuantity;
    form.elements.packUnit.value = productDefault.packUnit;
    if (packFields) {
      packFields.hidden = !productDefault.isMultipack;
    }
    clearFormError();
  };
  const syncSelectValue = (select, value) => {
    if (!select) {
      return;
    }

    const nextValue = [...select.options].some((option) => option.value === value) ? value : "";
    select.value = nextValue;
  };
  const applyHistorySelection = (select, input, afterApply) => {
    const value = String(select?.value ?? "").trim();
    if (!value || !input) {
      return;
    }

    input.value = value;
    afterApply?.();
    clearFormError();
  };

  productInput?.addEventListener("input", () => {
    syncTrimmedValidity();
    syncSelectValue(productHistorySelect, String(productInput.value ?? "").trim());
    applyProductDefaults();
  });
  productInput?.addEventListener("change", applyProductDefaults);
  productHistorySelect?.addEventListener("change", () => {
    applyHistorySelection(productHistorySelect, productInput, () => {
      syncTrimmedValidity();
      applyProductDefaults();
    });
  });
  categoryHistorySelect?.addEventListener("change", () => {
    applyHistorySelection(categoryHistorySelect, form.elements.category);
  });
  storeInput?.addEventListener("input", syncTrimmedValidity);
  storeHistorySelect?.addEventListener("change", () => {
    applyHistorySelection(storeHistorySelect, storeInput, syncTrimmedValidity);
  });
  quantityInput?.addEventListener("input", clearFormError);
  unitCountInput?.addEventListener("input", clearFormError);
  priceInput?.addEventListener("input", clearFormError);
  packQuantityInput?.addEventListener("input", clearFormError);
  multipackToggle?.addEventListener("change", () => {
    if (packFields) {
      packFields.hidden = !multipackToggle.checked;
    }
    clearFormError();
  });

  const submitPurchaseForm = () => {
    clearFormError();
    syncTrimmedValidity();

    if (!isFormValid(form)) {
      return;
    }

    const errorMessage = getPurchaseFormErrorMessage({
      quantity: Number(form.elements.quantity.value),
      unitCount: Number(form.elements.unitCount.value),
      packQuantity: form.elements.isMultipack.checked ? Number(form.elements.packQuantity.value) : 1,
      price: Number(form.elements.priceInput.value),
    });
    if (errorMessage) {
      showFormError(formError, errorMessage);
      return;
    }

    const didPreview = (actions.previewPurchase ?? actions.addPurchase)(readFormFields(form));
    if (!didPreview) {
      return;
    }

    form.reset();
  };

  const runPurchaseSubmit = (event) => {
    event.preventDefault();
    if (isSubmittingPurchaseForm) {
      return;
    }

    isSubmittingPurchaseForm = true;
    try {
      submitPurchaseForm();
    } catch (error) {
      console.error(error);
      showFormError(formError, "入力内容の確認中に問題が発生しました。もう一度お試しください。");
    }
    setTimeout(() => {
      isSubmittingPurchaseForm = false;
    }, 0);
  };

  form.addEventListener("submit", runPurchaseSubmit);

  submitButton?.addEventListener("click", runPurchaseSubmit);
  submitButton?.addEventListener("pointerup", runPurchaseSubmit);
  submitButton?.addEventListener("touchend", runPurchaseSubmit);
}

function bindConfirmation(actions) {
  const confirmButton = document.querySelector("[data-confirm-purchase]");
  const cancelButton = document.querySelector("[data-cancel-pending]");

  confirmButton?.addEventListener("click", () => {
    actions.confirmPurchase?.();
  });
  cancelButton?.addEventListener("click", () => {
    actions.cancelPendingPurchase?.();
  });
}

function bindEditing(actions) {
  const cancelEditingButton = document.querySelector("[data-cancel-editing]");
  cancelEditingButton?.addEventListener("click", () => {
    actions.cancelEditingPurchase?.();
  });
}

function bindPurchaseActions(actions) {
  document.querySelectorAll("[data-edit-purchase-id]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.editPurchase?.(button.dataset.editPurchaseId);
    });
  });

  document.querySelectorAll("[data-delete-purchase-id]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.deletePurchase?.(button.dataset.deletePurchaseId);
    });
  });
}

function bindMasterManagement(actions) {
  document.querySelectorAll("[data-product-manage-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      actions.updateProduct?.(form.dataset.managedProductId, {
        name: String(form.elements.name.value ?? ""),
        category: String(form.elements.category.value ?? ""),
      });
    });
  });

  document.querySelectorAll("[data-delete-product-id]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.deleteProduct?.(button.dataset.deleteProductId);
    });
  });

  document.querySelectorAll("[data-category-manage-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      actions.updateCategory?.(form.dataset.categoryName, String(form.elements.category.value ?? ""));
    });
  });

  document.querySelectorAll("[data-delete-category-name]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.deleteCategory?.(button.dataset.deleteCategoryName);
    });
  });

  document.querySelectorAll("[data-store-manage-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      actions.updateStore?.(form.dataset.storeId, String(form.elements.name.value ?? ""));
    });
  });

  document.querySelectorAll("[data-delete-store-id]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.deleteStore?.(button.dataset.deleteStoreId);
    });
  });
}

function bindCloudAccount(actions) {
  const form = document.querySelector("[data-cloud-login-form]");
  const signUpButton = document.querySelector("[data-cloud-sign-up]");
  const signOutButton = document.querySelector("[data-cloud-sign-out]");

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) {
      return;
    }

    actions.signInCloud?.(
      String(form.elements.email.value ?? ""),
      String(form.elements.password.value ?? "")
    );
  });

  signUpButton?.addEventListener("click", () => {
    if (!form?.reportValidity()) {
      return;
    }

    actions.signUpCloud?.(
      String(form.elements.email.value ?? ""),
      String(form.elements.password.value ?? "")
    );
  });

  signOutButton?.addEventListener("click", () => {
    actions.signOutCloud?.();
  });
}

function bindBackupActions(actions) {
  const exportButton = document.querySelector("[data-export-backup]");
  const importInput = document.querySelector("[data-import-backup]");

  exportButton?.addEventListener("click", () => {
    actions.exportBackup?.();
  });

  importInput?.addEventListener("change", () => {
    const file = importInput.files?.[0];
    actions.importBackup?.(file);
    importInput.value = "";
  });
}

function bindProductLinks(actions) {
  document.querySelectorAll("[data-product-id]").forEach((card) => {
    const openDetail = () => actions.setRoute({ name: "detail", productId: card.dataset.productId });

    card.addEventListener("click", openDetail);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetail();
      }
    });
  });
}

function dealLabel(value) {
  return { buy: "買い", normal: "普通", high: "高め", first: "初回" }[value] ?? "初回";
}

function cloudLabel(cloud) {
  if (!cloud?.isConfigured) {
    return "端末保存";
  }

  if (!cloud.session) {
    return "未ログイン";
  }

  return cloud.isSyncing ? "同期中" : "クラウド";
}

function formatPrice(value) {
  return formatNumberPrice(value, { trimWhole: false });
}

function formatUnitPrice(value) {
  return formatNumberPrice(value, { trimWhole: false });
}

function formatTotalPrice(value) {
  return formatNumberPrice(value, { trimWhole: true });
}

function renderSelectOption(value, label, selectedValue) {
  return `<option value="${escapeHtml(value)}"${value === selectedValue ? " selected" : ""}>${escapeHtml(label)}</option>`;
}

function renderValueOptions(values, selectedValue = "") {
  return values.map((value) => renderSelectOption(value, value, selectedValue)).join("");
}

function isMultipackEnabled(draft) {
  return draft.isMultipack === true || draft.isMultipack === "true" || draft.isMultipack === "on";
}

function getProductDefaults(form) {
  try {
    return JSON.parse(form.dataset.productDefaults ?? "{}");
  } catch {
    return {};
  }
}

function formatNumberPrice(value, { trimWhole }) {
  if (value === null || value === undefined) {
    return "なし";
  }

  const numeric = Number(value);
  if (trimWhole && Number.isInteger(numeric)) {
    return `${numeric}円`;
  }

  return `${numeric.toFixed(2)}円`;
}

function formatInterval(value) {
  if (value === null || value === undefined) {
    return "なし";
  }

  return `${value}日`;
}

function formatQuantity(value) {
  return Number(value).toLocaleString("ja-JP", { maximumFractionDigits: 2 });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatToday() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function setTrimmedRequiredValidity(input, value, message) {
  if (!input) {
    return;
  }

  input.setCustomValidity(value ? "" : message);
}

function showFormError(formError, message) {
  if (!formError) {
    return;
  }

  formError.textContent = message;
  formError.hidden = false;
}

function isFormValid(form) {
  if (typeof form.reportValidity === "function") {
    return form.reportValidity();
  }

  if (typeof form.checkValidity === "function") {
    return form.checkValidity();
  }

  return [...form.elements].every((element) => !element.required || String(element.value ?? "").trim());
}

function getCategoryNames(state) {
  return [...new Set(state.products.map((product) => product.category).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, "ja")
  );
}

function getProductNames(state) {
  const names = [
    ...state.products.map((product) => product.name),
    ...state.purchases.map((purchase) => purchase.productName),
  ];

  return uniqueSortedValues(names);
}

function getStoreNames(state) {
  const names = [
    ...state.stores.map((store) => store.name),
    ...state.purchases.map((purchase) => purchase.storeName),
  ];

  return uniqueSortedValues(names);
}

function uniqueSortedValues(values) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, "ja")
  );
}

function buildProductDefaults(state) {
  return Object.fromEntries(
    state.products.filter((product) => product.name).map((product) => {
      const latestPurchase = latestPurchaseForProduct(state, product.id);

      return [
        product.name,
        {
          category: product.category || "日用品",
          quantity: latestPurchase ? String(latestPurchase.quantity ?? "") : "",
          unit: latestPurchase?.unit ?? product.defaultUnit ?? "ml",
          isMultipack: Boolean(latestPurchase?.isMultipack),
          packQuantity: String(latestPurchase?.packQuantity ?? 1),
          packUnit: latestPurchase?.packUnit || "個",
        },
      ];
    })
  );
}

function latestPurchaseForProduct(state, productId) {
  return state.purchases
    .filter((purchase) => purchase.productId === productId)
    .sort((left, right) => comparePurchaseOrder(right, left))[0] ?? null;
}

function comparePurchaseOrder(left, right) {
  const dateComparison = String(left.purchasedAt).localeCompare(String(right.purchasedAt));
  if (dateComparison !== 0) {
    return dateComparison;
  }

  return String(left.createdAt ?? "").localeCompare(String(right.createdAt ?? ""));
}

export function getPurchaseDraft(formData) {
  return {
    productName: String(getFormFieldValue(formData, "productName") ?? "").trim(),
    category: String(getFormFieldValue(formData, "category") ?? "").trim() || "日用品",
    storeName: String(getFormFieldValue(formData, "storeName") ?? "").trim(),
  };
}

export function hasRequiredPurchaseNames(draft) {
  return Boolean(draft.productName && draft.storeName);
}

export function getPurchaseFormErrorMessage({ quantity, unitCount = 1, packQuantity = 1, price }) {
  if (quantity <= 0 || price <= 0) {
    return "容量と価格は0より大きい値で入力してください。";
  }

  if (unitCount <= 0) {
    return "購入数は0より大きい値で入力してください。";
  }

  if (packQuantity <= 0) {
    return "パック数量は0より大きい値で入力してください。";
  }

  return "";
}

export function getPurchaseCardView(purchase, state) {
  const productName =
    state.products.find((item) => item.id === purchase.productId)?.name ??
    purchase.productName ??
    "不明な商品";
  const storeName = state.stores.find((item) => item.id === purchase.storeId)?.name ?? purchase.storeName ?? "";

  return {
    purchaseId: purchase.id,
    productName,
    storeName,
    quantityLabel: formatPurchaseQuantityLabel(purchase),
    totalPaid: purchase.normalizedTaxIncludedPrice ?? purchase.priceInput ?? null,
    unitPrice: purchase.unitPrice,
    normalizedUnit: purchase.normalizedUnit,
    deal: purchase.deal ?? "",
  };
}

function formatPurchaseQuantityLabel(purchase) {
  const unitCount = purchase.unitCount ?? 1;
  const base = `${purchase.quantity}${purchase.unit}`;
  const withCount = unitCount > 1 ? `${base} × ${unitCount}` : base;

  if (purchase.isMultipack && purchase.packQuantity > 1) {
    return `${withCount} × ${purchase.packQuantity}${purchase.packUnit || "個"}`;
  }

  return withCount;
}

function readFormFields(form) {
  if (typeof FormData !== "undefined") {
    return new FormData(form);
  }

  return [...form.elements].reduce((fields, element) => {
    if (!element.name) {
      return fields;
    }

    fields[element.name] = element.type === "checkbox" ? (element.checked ? element.value || "on" : "") : element.value;
    return fields;
  }, {});
}

function getFormFieldValue(formData, name) {
  if (formData && typeof formData.get === "function") {
    return formData.get(name);
  }

  return formData?.[name];
}
