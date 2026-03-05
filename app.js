const VIEW_MODE_KEY = "productViewMode";

function loadPreferredViewMode() {
  try {
    const mode = localStorage.getItem(VIEW_MODE_KEY);
    if (mode === "list" || mode === "card") {
      return mode;
    }
  } catch (_error) {
  }
  return "list";
}

const state = {
  products: [],
  viewMode: loadPreferredViewMode(),
  filters: {
    keyword: "",
    customer: "",
    category: "",
    treeCustomer: "",
    treeCategory: "",
  },
};

const els = {
  keywordInput: document.getElementById("keywordInput"),
  customerSelect: document.getElementById("customerSelect"),
  categorySelect: document.getElementById("categorySelect"),
  resetBtn: document.getElementById("resetBtn"),
  treeNav: document.getElementById("treeNav"),
  resultCount: document.getElementById("resultCount"),
  productList: document.getElementById("productList"),
  viewListBtn: document.getElementById("viewListBtn"),
  viewCardBtn: document.getElementById("viewCardBtn"),
  productCardTemplate: document.getElementById("productCardTemplate"),
  imageModal: document.getElementById("imageModal"),
  modalImage: document.getElementById("modalImage"),
  closeModalBtn: document.getElementById("closeModalBtn"),
};

function uniqueSorted(list) {
  return [...new Set(list.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function buildSelect(selectEl, values, defaultText) {
  selectEl.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = defaultText;
  selectEl.append(defaultOption);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    selectEl.append(option);
  });
}

function resolveImageSrc(rawValue) {
  const value = (rawValue || "").trim();
  if (!value) {
    return "";
  }

  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) {
    return value;
  }

  return value.replace(/\\/g, "/");
}

function applyViewMode() {
  const isCard = state.viewMode === "card";
  els.productList.classList.toggle("view-card", isCard);
  els.productList.classList.toggle("view-list", !isCard);

  els.viewCardBtn.classList.toggle("active", isCard);
  els.viewListBtn.classList.toggle("active", !isCard);
}

function setViewMode(mode) {
  if (mode !== "list" && mode !== "card") {
    return;
  }

  state.viewMode = mode;
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch (_error) {
  }
  applyViewMode();
}

function applyTopFilters(products) {
  const keyword = state.filters.keyword.trim().toLowerCase();
  return products.filter((item) => {
    const customerOk = !state.filters.customer || item.customer === state.filters.customer;
    const categoryOk = !state.filters.category || item.category === state.filters.category;

    const keywordTarget = [item.code, item.name, item.customer, item.category, item.note]
      .join(" ")
      .toLowerCase();
    const keywordOk = !keyword || keywordTarget.includes(keyword);

    return customerOk && categoryOk && keywordOk;
  });
}

function applyAllFilters(products) {
  return products.filter((item) => {
    const treeCustomerOk = !state.filters.treeCustomer || item.customer === state.filters.treeCustomer;
    const treeCategoryOk = !state.filters.treeCategory || item.category === state.filters.treeCategory;
    return treeCustomerOk && treeCategoryOk;
  });
}

function groupTreeData(products) {
  const map = new Map();
  products.forEach((item) => {
    if (!map.has(item.customer)) {
      map.set(item.customer, new Map());
    }
    const customerMap = map.get(item.customer);
    customerMap.set(item.category, (customerMap.get(item.category) || 0) + 1);
  });
  return map;
}

function ensureTreeSelectionValid(groupedMap) {
  if (!state.filters.treeCustomer) {
    return;
  }

  if (!groupedMap.has(state.filters.treeCustomer)) {
    state.filters.treeCustomer = "";
    state.filters.treeCategory = "";
    return;
  }

  if (!state.filters.treeCategory) {
    return;
  }

  const categories = groupedMap.get(state.filters.treeCustomer);
  if (!categories.has(state.filters.treeCategory)) {
    state.filters.treeCategory = "";
  }
}

function createTreeButton({ label, customer = "", category = "", active = false }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `tree-item${active ? " active" : ""}`;
  button.dataset.customer = customer;
  button.dataset.category = category;
  button.textContent = label;
  return button;
}

function renderTree(baseProducts) {
  els.treeNav.innerHTML = "";
  const groupedMap = groupTreeData(baseProducts);
  ensureTreeSelectionValid(groupedMap);

  const allButton = createTreeButton({
    label: `全部产品 (${baseProducts.length})`,
    active: !state.filters.treeCustomer && !state.filters.treeCategory,
  });
  els.treeNav.append(allButton);

  const customers = [...groupedMap.keys()].sort((a, b) => a.localeCompare(b));
  customers.forEach((customer) => {
    const categories = groupedMap.get(customer);
    const total = [...categories.values()].reduce((sum, n) => sum + n, 0);

    const details = document.createElement("details");
    details.open = true;

    const summary = document.createElement("summary");
    summary.textContent = `${customer} (${total})`;
    details.append(summary);

    details.append(
      createTreeButton({
        label: `全部类型 (${total})`,
        customer,
        active: state.filters.treeCustomer === customer && !state.filters.treeCategory,
      })
    );

    [...categories.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([category, count]) => {
        details.append(
          createTreeButton({
            label: `${category} (${count})`,
            customer,
            category,
            active:
              state.filters.treeCustomer === customer && state.filters.treeCategory === category,
          })
        );
      });

    els.treeNav.append(details);
  });
}

function renderProducts(products) {
  els.productList.innerHTML = "";
  els.resultCount.textContent = `共 ${products.length} 条`;

  if (!products.length) {
    const tip = document.createElement("div");
    tip.className = "empty-tip";
    tip.textContent = "没有匹配的产品，请调整筛选条件。";
    els.productList.append(tip);
    return;
  }

  const fragment = document.createDocumentFragment();

  products.forEach((item, index) => {
    const node = els.productCardTemplate.content.cloneNode(true);
    const cardEl = node.querySelector(".product-card");
    cardEl.style.setProperty("--enter-delay", `${Math.min(index, 10) * 34}ms`);

    const mediaEl = node.querySelector(".product-media");
    const imageEl = node.querySelector(".product-image");
    const imageSrc = resolveImageSrc(item.image);
    imageEl.alt = item.name ? `${item.name} 图片` : "产品图片";
    if (imageSrc) {
      mediaEl.classList.remove("no-image");
      mediaEl.classList.remove("has-image");
      imageEl.addEventListener(
        "load",
        () => {
          mediaEl.classList.add("has-image");
        },
        { once: true }
      );
      imageEl.addEventListener(
        "error",
        () => {
          mediaEl.classList.remove("has-image");
          mediaEl.classList.add("no-image");
          imageEl.removeAttribute("src");
        },
        { once: true }
      );

      imageEl.src = imageSrc;
      if (imageEl.complete && imageEl.naturalWidth > 0) {
        mediaEl.classList.add("has-image");
      }
    }

    node.querySelector(".product-name").textContent = item.name || "未命名产品";

    node.querySelector(".product-meta").textContent =
      `客户: ${item.customer || "-"} | 类型: ${item.category || "-"} | 货号: ${item.code || "-"} | 价格: ${item.price || "-"}`;

    const noteEl = node.querySelector(".product-note");
    if (item.note) {
      noteEl.textContent = `备注: ${item.note}`;
    } else {
      noteEl.remove();
    }

    const linkEl = node.querySelector(".source-link");
    if (item.link) {
      linkEl.href = item.link;
    } else {
      linkEl.removeAttribute("href");
      linkEl.textContent = "无原链接";
      linkEl.style.pointerEvents = "none";
      linkEl.style.opacity = "0.45";
    }

    fragment.append(node);
  });

  els.productList.append(fragment);
}

function updateView() {
  applyViewMode();
  const baseProducts = applyTopFilters(state.products);
  renderTree(baseProducts);
  const filtered = applyAllFilters(baseProducts);
  renderProducts(filtered);
}

function bindEvents() {
  els.keywordInput.addEventListener("input", (event) => {
    state.filters.keyword = event.target.value;
    updateView();
  });

  els.customerSelect.addEventListener("change", (event) => {
    state.filters.customer = event.target.value;
    updateView();
  });

  els.categorySelect.addEventListener("change", (event) => {
    state.filters.category = event.target.value;
    updateView();
  });

  els.resetBtn.addEventListener("click", () => {
    state.filters = {
      keyword: "",
      customer: "",
      category: "",
      treeCustomer: "",
      treeCategory: "",
    };
    els.keywordInput.value = "";
    els.customerSelect.value = "";
    els.categorySelect.value = "";
    updateView();
  });

  els.treeNav.addEventListener("click", (event) => {
    const button = event.target.closest(".tree-item");
    if (!button) {
      return;
    }

    state.filters.treeCustomer = button.dataset.customer || "";
    state.filters.treeCategory = button.dataset.category || "";
    updateView();
  });

  els.viewListBtn.addEventListener("click", () => {
    setViewMode("list");
  });

  els.viewCardBtn.addEventListener("click", () => {
    setViewMode("card");
  });

  // Image modal logic
  function openImageModal(src) {
    if (!src) return;
    els.modalImage.src = src;
    els.imageModal.hidden = false;
    document.body.style.overflow = "hidden"; // Prevent background scrolling
  }

  function closeImageModal() {
    els.imageModal.hidden = true;
    els.modalImage.src = "";
    document.body.style.overflow = "";
  }

  els.productList.addEventListener("click", (event) => {
    const imgEl = event.target.closest(".product-image");
    if (imgEl && imgEl.src) {
      openImageModal(imgEl.src);
    }
  });

  els.closeModalBtn.addEventListener("click", closeImageModal);
  
  els.imageModal.addEventListener("click", (event) => {
    // Close if clicked on the backdrop, but not on the image itself
    if (event.target.classList.contains("modal-backdrop")) {
      closeImageModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.imageModal.hidden) {
      closeImageModal();
    }
  });
}

async function init() {
  try {
    const response = await fetch("data/products.json");
    if (!response.ok) {
      throw new Error(`数据加载失败: ${response.status}`);
    }

    state.products = await response.json();

    buildSelect(
      els.customerSelect,
      uniqueSorted(state.products.map((item) => item.customer)),
      "全部客户"
    );
    buildSelect(
      els.categorySelect,
      uniqueSorted(state.products.map((item) => item.category)),
      "全部类型"
    );

    bindEvents();
    updateView();
  } catch (error) {
    els.resultCount.textContent = "加载失败";
    els.productList.innerHTML = `<div class=\"empty-tip\">${error.message}</div>`;
  }
}

init();
