const DATA_AVAILABLE_PATH = "data/units.available.latest.json";
const DATA_FULL_PATH = "data/units.latest.json";
const MAX_MATCHES_RENDER = 100;

const ui = {
  lastUpdated: document.querySelector("#last-updated"),
  themeToggle: document.querySelector("#theme-toggle"),
  filterToggle: document.querySelector("#filter-toggle"),
  filtersPanel: document.querySelector("#filters-panel"),
  filtersClose: document.querySelector("#filters-close"),
  filtersApply: document.querySelector("#filters-apply"),
  matchesPanel: document.querySelector("#matches-panel"),
  matchesToggle: document.querySelector("#matches-toggle"),
  filtersReset: document.querySelector("#filters-reset"),
  filterSearch: document.querySelector("#filter-search"),
  filterEstate: document.querySelector("#filter-estate"),
  filterBlock: document.querySelector("#filter-block"),
  filterBlocks: document.querySelector("#filter-blocks"),
  filterFloorMin: document.querySelector("#filter-floor-min"),
  filterFloorMax: document.querySelector("#filter-floor-max"),
  filterSqftMin: document.querySelector("#filter-sqft-min"),
  filterSqftMax: document.querySelector("#filter-sqft-max"),
  filterSqmMin: document.querySelector("#filter-sqm-min"),
  filterSqmMax: document.querySelector("#filter-sqm-max"),
  filterPriceMin: document.querySelector("#filter-price-min"),
  filterPriceMax: document.querySelector("#filter-price-max"),
  filterOrientation: document.querySelector("#filter-orientation"),
  filterUnitType: document.querySelector("#filter-unit-type"),
  filterAvailability: document.querySelector("#filter-availability"),
  filterSort: document.querySelector("#filter-sort"),
  loadingState: document.querySelector("#loading-state"),
  emptyState: document.querySelector("#empty-state"),
  resultCount: document.querySelector("#result-count"),
  matchesCount: document.querySelector("#matches-count"),
  matchesList: document.querySelector("#matches-list"),
  estateTabs: document.querySelector("#estate-tabs"),
  blockTabs: document.querySelector("#block-tabs"),
  gridHead: document.querySelector("#grid-head"),
  gridBody: document.querySelector("#grid-body"),
  modal: document.querySelector("#unit-modal"),
  modalContent: document.querySelector("#modal-content"),
  modalClose: document.querySelector("#modal-close")
};

const ESTATE_LABELS_ZH = {
  "Ying Fai Street": "影輝苑",
  "Wui Hei Court": "匯熙苑",
  "Kai Yeung Court": "啟陽苑",
  "Yu Fung Court": "裕豐苑",
  "Long Fung Court": "朗風苑"
};

const state = {
  allUnits: [],
  selectedEstate: null,
  selectedBlock: null,
  filters: {
    search: "",
    estates: [],
    blocks: [],
    floorMin: null,
    floorMax: null,
    sqftMin: null,
    sqftMax: null,
    sqmMin: null,
    sqmMax: null,
    priceMin: null,
    priceMax: null,
    orientation: "",
    unitType: "",
    availability: "available",
    sort: "saleableAreaSqft:desc,floor:desc,priceHkd:asc,block:asc"
  }
};

init();

async function init() {
  applySavedTheme();
  bindUIEvents();
  setLoading(true);

  try {
    const datasets = await loadDatasets();
    state.allUnits = datasets.units;
    ui.lastUpdated.textContent = `最後更新：${datasets.lastUpdatedHk || "未提供"}`;

    if (!state.allUnits.length) {
      ui.emptyState.textContent = "資料集中沒有可顯示的單位。";
      ui.emptyState.classList.remove("hidden");
      return;
    }

    initSelections();
    hydrateFilterOptions();
    syncFilterEstateBlockOptions();
    applyFilterStateToInputs();
    renderTabsAndGrid();
    renderMatchesList();
  } catch (error) {
    ui.lastUpdated.textContent = "最後更新：無法讀取";
    ui.emptyState.textContent = "無法載入資料，請檢查資料檔案。";
    ui.emptyState.classList.remove("hidden");
    console.error(error);
  } finally {
    setLoading(false);
  }
}

async function loadDatasets() {
  let availablePayload = null;
  let fullPayload = null;

  try {
    availablePayload = await fetchPayload(DATA_AVAILABLE_PATH);
  } catch (error) {
    console.warn("Available dataset not found, using full dataset only.", error);
  }

  try {
    fullPayload = await fetchPayload(DATA_FULL_PATH);
  } catch (error) {
    if (!availablePayload) {
      throw error;
    }
    console.warn("Full dataset not found, using available dataset as fallback.", error);
  }

  const availableUnits = availablePayload?.units || [];
  const fullUnits = fullPayload?.units || availableUnits;
  const availableIds = new Set(availableUnits.map((u) => u.unitId));

  const merged = fullUnits.map((unit) => ({
    ...unit,
    availability: availableIds.size ? (availableIds.has(unit.unitId) ? "available" : "unavailable") : "available"
  }));

  return {
    units: merged,
    lastUpdatedHk: availablePayload?.meta?.lastUpdatedHk || fullPayload?.meta?.lastUpdatedHk || null
  };
}

async function fetchPayload(path) {
  const response = await fetch(path, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${path}`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload.units)) {
    throw new Error(`Invalid payload format for ${path}`);
  }
  return payload;
}

function bindUIEvents() {
  ui.themeToggle.addEventListener("click", toggleTheme);

  if (ui.filterToggle) {
    ui.filterToggle.addEventListener("click", () => {
      ui.filtersPanel.classList.remove("hidden");
      ui.filtersPanel.classList.add("is-open");
      document.body.classList.add("filters-open");
    });
  }
  if (ui.filtersClose) {
    ui.filtersClose.addEventListener("click", closeFiltersPanel);
  }
  if (ui.filtersApply) {
    ui.filtersApply.addEventListener("click", () => {
      syncFilterEstateBlockOptions();
      renderTabsAndGrid();
      renderMatchesList();
      closeFiltersPanel();
      setMatchesPanelOpen(true);
    });
  }

  if (ui.matchesToggle) {
    ui.matchesToggle.addEventListener("click", () => {
      setMatchesPanelOpen(!ui.matchesPanel.classList.contains("matches-panel-open"));
    });
  }

  if (ui.filtersReset) {
    ui.filtersReset.addEventListener("click", () => {
      state.filters = {
        search: "",
        estates: [],
        blocks: [],
        floorMin: null,
        floorMax: null,
        sqftMin: null,
        sqftMax: null,
        sqmMin: null,
        sqmMax: null,
        priceMin: null,
        priceMax: null,
        orientation: "",
        unitType: "",
        availability: "available",
        sort: "saleableAreaSqft:desc,floor:desc,priceHkd:asc,block:asc"
      };
      applyFilterStateToInputs();
      syncFilterEstateBlockOptions();
      renderMatchesList();
    });
  }

  const syncAndRender = () => {
    updateMultiSelectSummary(ui.filterBlocks);
    updateFiltersFromInputs();
    renderMatchesList();
  };

  [
    ui.filterSearch,
    ui.filterFloorMin,
    ui.filterFloorMax,
    ui.filterSqftMin,
    ui.filterSqftMax,
    ui.filterSqmMin,
    ui.filterSqmMax,
    ui.filterPriceMin,
    ui.filterPriceMax
  ].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", syncAndRender);
  });

  [
    ui.filterAvailability,
    ui.filterOrientation,
    ui.filterUnitType,
    ui.filterSort,
    ui.filterBlocks
  ].forEach((el) => {
    if (!el) return;
    el.addEventListener("change", syncAndRender);
  });

  if (ui.filterEstate) {
    ui.filterEstate.addEventListener("change", () => {
      state.filters.estates = selectedValues(ui.filterEstate);
      const firstSelectedEstate = state.filters.estates[0] || null;
      if (firstSelectedEstate) {
        state.selectedEstate = firstSelectedEstate;
      }
      const blocks = getBlocksForSelectedEstates();
      if (!blocks.includes(state.selectedBlock)) {
        state.selectedBlock = blocks[0] || null;
      }
      syncFilterEstateBlockOptions();
      renderTabsAndGrid();
      renderMatchesList();
    });
  }

  if (ui.filterBlock) {
    ui.filterBlock.addEventListener("change", () => {
      state.selectedBlock = ui.filterBlock.value;
      renderTabsAndGrid();
      closeFiltersPanel();
    });
  }

  if (ui.modalClose) {
    ui.modalClose.addEventListener("click", closeModal);
  }
  if (ui.modal) {
    ui.modal.addEventListener("click", (event) => {
      if (event.target === ui.modal) {
        closeModal();
      }
    });
  }
}

function initSelections() {
  const estates = unique(state.allUnits.map((u) => u.estate));
  state.selectedEstate = estates[0] || null;

  const blocks = unique(
    state.allUnits
      .filter((u) => u.estate === state.selectedEstate)
      .map((u) => u.block)
  );
  state.selectedBlock = blocks[0] || null;
}

function hydrateFilterOptions() {
  const estates = unique(state.allUnits.map((u) => u.estate));
  renderMultiSelectOptions(ui.filterEstate, estates, toZhEstate);

  const orientations = unique(state.allUnits.map((u) => u.orientation || ""));
  const unitTypes = unique(state.allUnits.map((u) => u.unitType || ""));
  if (ui.filterOrientation) {
    ui.filterOrientation.innerHTML = [
      `<option value="">全部座向</option>`,
      `<option value="__NONE__">未提供</option>`,
      ...orientations.filter(Boolean).map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`)
    ].join("");
  }

  if (ui.filterUnitType) {
    ui.filterUnitType.innerHTML = [
      `<option value="">全部戶型</option>`,
      `<option value="__NONE__">未提供</option>`,
      ...unitTypes.filter(Boolean).map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`)
    ].join("");
  }
}

function applyFilterStateToInputs() {
  if (ui.filterSearch) ui.filterSearch.value = state.filters.search;
  ui.filterFloorMin.value = valueOrEmpty(state.filters.floorMin);
  ui.filterFloorMax.value = valueOrEmpty(state.filters.floorMax);
  ui.filterSqftMin.value = valueOrEmpty(state.filters.sqftMin);
  ui.filterSqftMax.value = valueOrEmpty(state.filters.sqftMax);
  if (ui.filterSqmMin) ui.filterSqmMin.value = valueOrEmpty(state.filters.sqmMin);
  if (ui.filterSqmMax) ui.filterSqmMax.value = valueOrEmpty(state.filters.sqmMax);
  ui.filterPriceMin.value = valueOrEmpty(state.filters.priceMin);
  ui.filterPriceMax.value = valueOrEmpty(state.filters.priceMax);
  ui.filterAvailability.value = state.filters.availability;
  ui.filterSort.value = state.filters.sort;
  if (ui.filterOrientation) ui.filterOrientation.value = state.filters.orientation;
  if (ui.filterUnitType) ui.filterUnitType.value = state.filters.unitType;
  setMultiSelectValues(ui.filterEstate, state.filters.estates);
  setMultiSelectValues(ui.filterBlocks, state.filters.blocks);
}

function updateFiltersFromInputs() {
  if (ui.filterSearch) state.filters.search = ui.filterSearch.value.trim().toLowerCase();
  state.filters.floorMin = parseNumberOrNull(ui.filterFloorMin.value);
  state.filters.floorMax = parseNumberOrNull(ui.filterFloorMax.value);
  state.filters.sqftMin = parseNumberOrNull(ui.filterSqftMin.value);
  state.filters.sqftMax = parseNumberOrNull(ui.filterSqftMax.value);
  if (ui.filterSqmMin) state.filters.sqmMin = parseNumberOrNull(ui.filterSqmMin.value);
  if (ui.filterSqmMax) state.filters.sqmMax = parseNumberOrNull(ui.filterSqmMax.value);
  state.filters.priceMin = parseNumberOrNull(ui.filterPriceMin.value);
  state.filters.priceMax = parseNumberOrNull(ui.filterPriceMax.value);
  state.filters.availability = ui.filterAvailability.value;
  state.filters.sort = ui.filterSort.value;
  if (ui.filterOrientation) state.filters.orientation = ui.filterOrientation.value;
  if (ui.filterUnitType) state.filters.unitType = ui.filterUnitType.value;
  state.filters.blocks = selectedValues(ui.filterBlocks);
  state.filters.estates = selectedValues(ui.filterEstate);
}

function renderTabsAndGrid() {
  renderEstateTabs();
  renderBlockTabs();
  renderGrid();
}

function renderEstateTabs() {
  const estates = unique(state.allUnits.map((u) => u.estate));
  ui.estateTabs.innerHTML = estates
    .map(
      (estate) =>
        `<button class="tab-btn ${estate === state.selectedEstate ? "active" : ""}" data-estate="${escapeHtml(estate)}">${escapeHtml(toZhEstate(estate))}</button>`
    )
    .join("");

  ui.estateTabs.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedEstate = btn.dataset.estate;
      const blocks = unique(
        state.allUnits
          .filter((u) => u.estate === state.selectedEstate)
          .map((u) => u.block)
      );
      state.selectedBlock = blocks[0] || null;
      syncFilterEstateBlockOptions();
      renderTabsAndGrid();
    });
  });
}

function renderBlockTabs() {
  const blocks = unique(
    state.allUnits
      .filter((u) => u.estate === state.selectedEstate)
      .map((u) => u.block)
  );

  ui.blockTabs.innerHTML = blocks
    .map(
      (block) =>
        `<button class="tab-btn ${block === state.selectedBlock ? "active" : ""}" data-block="${escapeHtml(block)}">${escapeHtml(toZhBlock(block))}</button>`
    )
    .join("");

  ui.blockTabs.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedBlock = btn.dataset.block;
      ui.filterBlock.value = state.selectedBlock;
      renderGrid();
      renderBlockTabs();
    });
  });
}

function getCurrentMatrixUnits() {
  return state.allUnits.filter(
    (u) => u.estate === state.selectedEstate && u.block === state.selectedBlock
  );
}

function syncFilterEstateBlockOptions() {
  if (!ui.filterEstate || !ui.filterBlocks) return;

  setMultiSelectValues(ui.filterEstate, state.filters.estates);

  if (ui.filterBlock) {
    const blocks = unique(
      state.allUnits
        .filter((u) => u.estate === state.selectedEstate)
        .map((u) => u.block)
    );

    ui.filterBlock.innerHTML = blocks
      .map((block) => `<option value="${escapeHtml(block)}">${escapeHtml(toZhBlock(block))}</option>`)
      .join("");
    ui.filterBlock.value = state.selectedBlock || blocks[0] || "";
  }

  const blockCandidates = getBlocksForSelectedEstates();
  renderMultiSelectOptions(ui.filterBlocks, blockCandidates, toZhBlock);

  const validBlockSet = new Set(blockCandidates);
  state.filters.blocks = state.filters.blocks.filter((b) => validBlockSet.has(b));
  setMultiSelectValues(ui.filterBlocks, state.filters.blocks);
}

function getBlocksForSelectedEstates() {
  const selectedEstateSet = new Set(state.filters.estates);
  const pool = selectedEstateSet.size
    ? state.allUnits.filter((u) => selectedEstateSet.has(u.estate))
    : state.allUnits;
  return unique(pool.map((u) => u.block));
}

function closeFiltersPanel() {
  if (!ui.filtersPanel) return;

  ui.filtersPanel.classList.remove("is-open");
  ui.filtersPanel.classList.add("hidden");

  document.body.classList.remove("filters-open");
}

function setMatchesPanelOpen(open) {
  ui.matchesPanel.classList.toggle("matches-panel-open", open);
  ui.matchesPanel.classList.toggle("hidden", !open);
  ui.matchesToggle.setAttribute("aria-expanded", String(open));
  ui.matchesToggle.textContent = open ? "關閉單位列表" : "符合篩選單位";
}

function renderGrid() {
  const rows = getCurrentMatrixUnits();
  const isEmpty = rows.length === 0;
  ui.emptyState.classList.toggle("hidden", !isEmpty);

  if (isEmpty) {
    ui.gridHead.innerHTML = "";
    ui.gridBody.innerHTML = "";
    ui.resultCount.textContent = "可選 0 / 總數 0";
    return;
  }

  const unitNumbers = unique(rows.map((r) => r.unitNumber)).sort(sortUnitNumber);
  const floors = unique(rows.map((r) => r.floor)).sort((a, b) => Number(b) - Number(a));
  const unitMap = new Map(rows.map((r) => [`${r.floor}|${r.unitNumber}`, r]));

  const availableCount = rows.filter((r) => r.availability === "available").length;
  ui.resultCount.textContent = `可選 ${availableCount} / 總數 ${rows.length}`;

  ui.gridHead.innerHTML = `
    <tr>
      <th class="floor-header">樓層</th>
      ${unitNumbers.map((unitNo) => `<th>${escapeHtml(unitNo)}室</th>`).join("")}
    </tr>
  `;

  ui.gridBody.innerHTML = floors
    .map((floor, index) => {
      const floorCells = unitNumbers
        .map((unitNo) => {
          const unit = unitMap.get(`${floor}|${unitNo}`);
          if (!unit) {
            return `<td class="unit-cell empty">-</td>`;
          }
          const statusClass = unit.availability === "available" ? "available" : "unavailable";
          const statusLabel = unit.availability === "available" ? "可選" : "不可選";
          return `
            <td
              class="unit-cell ${statusClass}"
              data-unit-id="${escapeHtml(unit.unitId || "")}" 
              title="${statusLabel}"
              tabindex="0"
              role="button"
              aria-label="${statusLabel} ${escapeHtml(String(unit.floor))}樓 ${escapeHtml(unit.unitNumber)}室"
            >
              ${escapeHtml(unit.unitNumber)}
            </td>
          `;
        })
        .join("");

      return `
        ${index === 0 ? `<tr><th class="floor-header" colspan="${unitNumbers.length + 1}">頂樓</th></tr>` : ""}
        <tr>
          <th class="floor-header">${escapeHtml(String(floor))}樓</th>
          ${floorCells}
        </tr>
      `;
    })
    .join("");

  bindGridInteractions(rows);
}

function applyAdvancedFilters(rows) {
  const estateSet = new Set(state.filters.estates);
  const blocksSet = new Set(state.filters.blocks);
  const result = rows.filter((u) => {
    if (state.filters.availability !== "all" && u.availability !== state.filters.availability) {
      return false;
    }
    if (estateSet.size && !estateSet.has(u.estate)) {
      return false;
    }
    if (blocksSet.size && !blocksSet.has(u.block)) {
      return false;
    }
    if (state.filters.floorMin != null && Number(u.floor) < state.filters.floorMin) {
      return false;
    }
    if (state.filters.floorMax != null && Number(u.floor) > state.filters.floorMax) {
      return false;
    }
    if (state.filters.sqftMin != null && Number(u.saleableAreaSqft) < state.filters.sqftMin) {
      return false;
    }
    if (state.filters.sqftMax != null && Number(u.saleableAreaSqft) > state.filters.sqftMax) {
      return false;
    }
    if (state.filters.sqmMin != null && Number(u.saleableAreaSqm) < state.filters.sqmMin) {
      return false;
    }
    if (state.filters.sqmMax != null && Number(u.saleableAreaSqm) > state.filters.sqmMax) {
      return false;
    }
    if (state.filters.priceMin != null && Number(u.priceHkd) < state.filters.priceMin) {
      return false;
    }
    if (state.filters.priceMax != null && Number(u.priceHkd) > state.filters.priceMax) {
      return false;
    }
    if (state.filters.orientation === "__NONE__" && u.orientation) {
      return false;
    }
    if (state.filters.orientation && state.filters.orientation !== "__NONE__" && u.orientation !== state.filters.orientation) {
      return false;
    }
    if (state.filters.unitType === "__NONE__" && u.unitType) {
      return false;
    }
    if (state.filters.unitType && state.filters.unitType !== "__NONE__" && u.unitType !== state.filters.unitType) {
      return false;
    }

    if (state.filters.search) {
      const text = [
        toZhEstate(u.estate),
        toZhBlock(u.block),
        u.floor,
        u.unitNumber,
        u.saleableAreaSqft,
        u.saleableAreaSqm,
        u.priceHkd,
        u.orientation,
        u.unitType
      ].join(" ").toLowerCase();
      if (!text.includes(state.filters.search)) {
        return false;
      }
    }

    return true;
  });

  return sortUnits(result, state.filters.sort);
}

function sortUnits(rows, sortValue) {
  if (!sortValue) {
    return [...rows];
  }
  const sortRules = sortValue.split(",").map((rule) => {
    const [field, direction] = rule.split(":");
    return [field, direction === "desc" ? -1 : 1];
  });
  return [...rows].sort((a, b) => {
    for (const [field, mul] of sortRules) {
      const av = numericOrString(a[field]);
      const bv = numericOrString(b[field]);
      if (av !== bv) return av > bv ? mul : -mul;
    }
    return 0;
  });
}

function renderMatchesList() {
  const matched = applyAdvancedFilters(state.allUnits);
  const shown = matched.slice(0, MAX_MATCHES_RENDER);

  ui.matchesCount.textContent = `${matched.length} 筆${matched.length > MAX_MATCHES_RENDER ? `（顯示前 ${MAX_MATCHES_RENDER} 筆）` : ""}`;

  if (!shown.length) {
    ui.matchesList.innerHTML = `<div class="rounded-xl bg-white/90 p-4 text-sm font-semibold text-slate-700 shadow-sm dark:bg-slate-800/80 dark:text-slate-200">沒有符合條件的單位，請調整篩選條件。</div>`;
    return;
  }

  ui.matchesList.innerHTML = shown
    .map((u) => {
      const statusClass = u.availability === "available" ? "text-emerald-700 dark:text-emerald-300" : "text-slate-600 dark:text-slate-300";
      const statusLabel = u.availability === "available" ? "可選" : "不可選";
      return `
        <article class="match-card rounded-xl bg-white/90 p-3 shadow-sm dark:bg-slate-800/80" data-unit-id="${escapeHtml(u.unitId || "")}">
          <div class="mb-1 flex items-center justify-between">
            <h4 class="text-sm font-extrabold text-slate-900 dark:text-slate-100">${escapeHtml(toZhEstate(u.estate))} ${escapeHtml(toZhBlock(u.block))}</h4>
            <span class="text-xs font-bold ${statusClass}">${statusLabel}</span>
          </div>
          <p class="text-xs font-semibold text-slate-700 dark:text-slate-200">${escapeHtml(String(u.floor))}樓 ${escapeHtml(u.unitNumber)}室</p>
          <div class="mt-2 grid grid-cols-2 gap-1 text-xs font-semibold text-slate-500 dark:text-slate-200">
            <p>面積：${escapeHtml(String(u.saleableAreaSqft || "-"))} 呎</p>
            <p>價格：${formatPrice(u.priceHkd)}</p>
            <p>座向：${escapeHtml(u.orientation || "未提供")}</p>
            <p>戶型：${escapeHtml(u.unitType || "未提供")}</p>
          </div>
        </article>
      `;
    })
    .join("");

  const matchedMap = new Map(shown.map((u) => [u.unitId, u]));
  ui.matchesList.querySelectorAll(".match-card").forEach((card) => {
    const unit = matchedMap.get(card.dataset.unitId);
    if (!unit) return;
    card.addEventListener("click", () => openModal(unit));
  });
}

function bindGridInteractions(rows) {
  const rowById = new Map(rows.map((r) => [r.unitId, r]));
  ui.gridBody.querySelectorAll(".unit-cell.available, .unit-cell.unavailable").forEach((cell) => {
    const unit = rowById.get(cell.dataset.unitId);
    if (!unit) return;

    cell.addEventListener("click", () => {
      openModal(unit);
    });

    cell.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openModal(unit);
      }
    });
  });
}

function openModal(unit) {
  if (!ui.modal || !ui.modalContent) return;
  ui.modalContent.innerHTML = renderUnitInfo(unit);
  ui.modal.classList.remove("hidden");
}

function closeModal() {
  if (!ui.modal) return;
  ui.modal.classList.add("hidden");
}

function renderUnitInfo(unit) {
  const availabilityClass = unit.availability === "available" ? "text-emerald-700 dark:text-emerald-300" : "text-slate-700 dark:text-slate-300";
  const availabilityLabel = unit.availability === "available" ? "可選" : "不可選";
  return `
    <div class="space-y-1 text-sm">
      <p class="font-bold text-slate-900 dark:text-slate-100">${escapeHtml(toZhEstate(unit.estate))} ${escapeHtml(toZhBlock(unit.block))} ${escapeHtml(String(unit.floor))}樓 ${escapeHtml(unit.unitNumber)}室</p>
      <p class="font-semibold ${availabilityClass}">狀態：${availabilityLabel}</p>
      <p>售價：${formatPrice(unit.priceHkd)}</p>
      <p>實用面積：${escapeHtml(String(unit.saleableAreaSqft || "-"))} 平方呎 (${escapeHtml(String(unit.saleableAreaSqm || "-"))} 平方米)</p>
      <p>座向：${escapeHtml(unit.orientation || "未提供")}</p>
      <p>戶型：${escapeHtml(unit.unitType || "未提供")}</p>
      <p class="text-xs text-slate-500 dark:text-slate-400">Unit ID：${escapeHtml(unit.unitId || "-")}</p>
    </div>
  `;
}

function applySavedTheme() {
  const theme = localStorage.getItem("hos2025-theme") || "light";
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("hos2025-theme", isDark ? "dark" : "light");
}

function formatPrice(value) {
  if (typeof value !== "number") return "-";
  return new Intl.NumberFormat("en-HK", {
    style: "currency",
    currency: "HKD",
    maximumFractionDigits: 0
  }).format(value);
}

function setLoading(isLoading) {
  ui.loadingState.classList.toggle("hidden", !isLoading);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function parseNumberOrNull(value) {
  if (value == null || value === "") {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function valueOrEmpty(value) {
  return value == null ? "" : String(value);
}

function selectedValues(select) {
  return [...select.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
}

function setMultiSelectValues(select, values) {
  if (!select) return;
  const set = new Set(values || []);
  select.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.checked = set.has(input.value);
  });
  updateMultiSelectSummary(select);
}

function renderMultiSelectOptions(select, values, labelForValue) {
  select.querySelector(".multi-select-options").innerHTML = values
    .map((value) => `<label><input type="checkbox" value="${escapeHtml(value)}"><span>${escapeHtml(labelForValue(value))}</span></label>`)
    .join("");
  updateMultiSelectSummary(select);
}

function updateMultiSelectSummary(select) {
  const summary = select.querySelector("summary");
  const selectedCount = selectedValues(select).length;
  const label = summary.dataset.placeholder;
  summary.textContent = selectedCount ? `已選 ${selectedCount} ${summary.dataset.selectedUnit}` : label;
}

function numericOrString(value) {
  if (value == null) return Number.NEGATIVE_INFINITY;
  const n = Number(value);
  return Number.isFinite(n) ? n : String(value);
}

function toZhEstate(estate) {
  return ESTATE_LABELS_ZH[estate] || estate;
}

function toZhBlock(block) {
  const match = String(block || "").match(/Block\s*([A-Z0-9]+)/i);
  if (match) {
    return `${match[1]}座`;
  }
  return String(block || "");
}

function sortUnitNumber(a, b) {
  const aNum = Number(a);
  const bNum = Number(b);
  if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
    return aNum - bNum;
  }
  return String(a).localeCompare(String(b));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
