const shell = document.querySelector(".app-shell");
const toggle = document.querySelector(".lnb-toggle");

toggle.addEventListener("click", () => {
  const isExpanded = shell.dataset.lnbState === "expanded";
  shell.dataset.lnbState = isExpanded ? "collapsed" : "expanded";
  toggle.setAttribute("aria-expanded", String(!isExpanded));
  toggle.setAttribute("aria-label", isExpanded ? "LNB 펼치기" : "LNB 접기");
});

const projects = [
  { id: "P-1001", name: "알파 프로젝트", owner: "김민준", status: "진행중", budget: "12,000", due: "2026-06-20" },
  { id: "P-1002", name: "브라보 캠페인", owner: "이서연", status: "검토", budget: "8,400", due: "2026-06-24" },
  { id: "P-1003", name: "찰리 개선안", owner: "박지호", status: "완료", budget: "15,700", due: "2026-07-01" },
  { id: "P-1004", name: "델타 운영", owner: "최하윤", status: "대기", budget: "6,200", due: "2026-07-08" },
];

const rowsByProject = {
  "P-1001": [
    ["A-01", "매출 데이터", "정상", "98%"],
    ["A-02", "고객 세그먼트", "검토", "76%"],
    ["A-03", "전환 지표", "정상", "84%"],
  ],
  "P-1002": [
    ["B-01", "광고 소재", "진행중", "62%"],
    ["B-02", "랜딩 페이지", "대기", "40%"],
    ["B-03", "성과 리포트", "검토", "71%"],
  ],
  "P-1003": [
    ["C-01", "백로그", "완료", "100%"],
    ["C-02", "사용성 점검", "완료", "100%"],
    ["C-03", "배포 체크", "완료", "100%"],
  ],
  "P-1004": [
    ["D-01", "운영 현황", "대기", "25%"],
    ["D-02", "문의 처리", "진행중", "55%"],
    ["D-03", "정산 내역", "대기", "18%"],
  ],
};

let selectedCardGridId = projects[0].id;
let selectedCardFormId = projects[0].id;
let selectedCell = { row: 0, col: 1, value: "알파 프로젝트", projectId: projects[0].id };
const sortStates = new Map();
const checkedRowsByTable = new Map();
const selectedRowByTable = new Map();
let activeSelection = null;

function getTableKey(target) {
  return target.id || target.dataset.tableKey || "default";
}

function normalizeSortValue(value) {
  const text = String(value).trim();
  const numeric = Number(text.replaceAll(",", "").replace("%", ""));
  return Number.isNaN(numeric) ? text : numeric;
}

function isNumericValue(value) {
  const text = String(value).trim();
  return text !== "" && !Number.isNaN(Number(text.replaceAll(",", "").replace("%", "")));
}

function getRowKey(row, meta, rowIndex) {
  return meta.rowKey || meta.projectId || row[0] || `row-${rowIndex}`;
}

function getCheckedRows(tableKey) {
  return checkedRowsByTable.get(tableKey) || [];
}

function getSelectedRow(tableKey) {
  return selectedRowByTable.get(tableKey) || null;
}

function getActiveRows() {
  if (!activeSelection) return [];
  return activeSelection.type === "checked"
    ? getCheckedRows(activeSelection.tableKey)
    : [getSelectedRow(activeSelection.tableKey)].filter(Boolean);
}

function setCheckedRows(tableKey, rows) {
  if (rows.length > 0) {
    checkedRowsByTable.set(tableKey, rows);
    activeSelection = { tableKey, type: "checked" };
  } else {
    checkedRowsByTable.delete(tableKey);
    if (activeSelection?.tableKey === tableKey && activeSelection.type === "checked") {
      activeSelection = getSelectedRow(tableKey) ? { tableKey, type: "row" } : null;
    }
  }
  updateActionDock();
}

function setSelectedRow(tableKey, row) {
  selectedRowByTable.set(tableKey, row);
  activeSelection = { tableKey, type: "row" };
  updateActionDock();
}

function clearTableSelection(tableKey) {
  checkedRowsByTable.delete(tableKey);
  selectedRowByTable.delete(tableKey);
  if (activeSelection?.tableKey === tableKey) {
    activeSelection = null;
  }
  updateActionDock();
}

function updateActionDock(statusMessage = "") {
  const dock = document.querySelector(".action-dock");
  const title = document.querySelector("#dock-title");
  const message = document.querySelector("#dock-message");
  const selectedRows = getActiveRows();

  dock.classList.toggle("is-active", selectedRows.length > 0);

  if (selectedRows.length === 0) {
    title.textContent = "선택된 행에 대해 어떤 작업을 수행하시겠습니까?";
    message.textContent = statusMessage || "선택된 데이터가 없습니다.";
    return;
  }

  title.textContent =
    activeSelection?.type === "row"
      ? "선택된 행에 대해 어떤 작업을 수행하시겠습니까?"
      : "체크된 데이터에 대해 어떤 작업을 수행하시겠습니까?";
  message.textContent =
    statusMessage ||
    `${selectedRows.length}건 ${activeSelection?.type === "row" ? "선택됨" : "체크됨"} · ${selectedRows
      .map((item) => item.row[0])
      .join(", ")}`;
}

function downloadSelectedRows() {
  const selectedRows = getActiveRows();
  if (selectedRows.length === 0) return;

  const csv = selectedRows
    .map((item) => item.row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "selected-grid-data.csv";
  link.click();
  URL.revokeObjectURL(url);
  updateActionDock(`${selectedRows.length}건 엑셀다운로드 처리 완료`);
}

function renderTable(target, headers, rows, options = {}) {
  const tableKey = getTableKey(target);
  const sortState = sortStates.get(tableKey) || [];
  const sourceRows = rows.map((row, index) => ({
    row,
    meta: options.rowMeta?.[index] || {},
  }));
  const displayRows = [...sourceRows];
  const checkedRows = getCheckedRows(tableKey);
  const checkedKeys = new Set(checkedRows.map((item) => item.key));
  const selectedRow = getSelectedRow(tableKey);

  if (sortState.length > 0) {
    displayRows.sort((a, b) => {
      for (const sortItem of sortState) {
        const aValue = normalizeSortValue(a.row[sortItem.column]);
        const bValue = normalizeSortValue(b.row[sortItem.column]);
        const result =
          typeof aValue === "number" && typeof bValue === "number"
            ? aValue - bValue
            : String(aValue).localeCompare(String(bValue), "ko");

        if (result !== 0) {
          return sortItem.direction === "asc" ? result : -result;
        }
      }

      return 0;
    });
  }

  const table = document.createElement("table");
  table.className = "data-grid";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");

  const checkTh = document.createElement("th");
  checkTh.className = "check-cell";
  checkTh.innerHTML = `<input type="checkbox" aria-label="전체 행 선택" />`;
  const headerCheckbox = checkTh.querySelector("input");
  headerCheckbox.checked = displayRows.length > 0 && displayRows.every(({ row, meta }, index) =>
    checkedKeys.has(getRowKey(row, meta, index)),
  );
  headerCheckbox.addEventListener("change", () => {
    const hasSelectedRow = Boolean(getSelectedRow(tableKey));
    const shouldCheckLatest =
      hasSelectedRow &&
      window.confirm(
        "선택된 행이 있습니다.\n확인: 선택 해제 후 체크 작업 수행\n취소: 선택 상태 유지",
      );

    if (hasSelectedRow && !shouldCheckLatest) {
      activeSelection = { tableKey, type: "row" };
      updateActionDock();
      renderTable(target, headers, rows, options);
      return;
    }

    if (hasSelectedRow) {
      selectedRowByTable.delete(tableKey);
    }

    const nextRows = headerCheckbox.checked
      ? displayRows.map(({ row, meta }, index) => ({
          key: getRowKey(row, meta, index),
          row,
          meta,
        }))
      : [];
    setCheckedRows(tableKey, nextRows);
    renderTable(target, headers, rows, options);
  });
  headRow.appendChild(checkTh);

  headers.forEach((header, columnIndex) => {
    const th = document.createElement("th");
    const button = document.createElement("button");
    const sortIndex = sortState.findIndex((item) => item.column === columnIndex);
    const sortItem = sortIndex >= 0 ? sortState[sortIndex] : null;
    const arrow = sortItem ? (sortItem.direction === "asc" ? "▲" : "▼") : "";
    const sortOrder = sortItem ? sortIndex + 1 : "";

    button.className = "sort-button";
    button.type = "button";
    button.innerHTML = `
      <span>${header}</span>
      <span class="sort-status">
        <span class="sort-arrow">${arrow}</span>
        <span class="sort-order">${sortOrder}</span>
      </span>
    `;
    button.addEventListener("click", () => {
      const currentSort = sortStates.get(tableKey) || [];
      const currentIndex = currentSort.findIndex((item) => item.column === columnIndex);
      let nextSort;

      if (currentIndex < 0) {
        nextSort = [...currentSort, { column: columnIndex, direction: "asc" }];
      } else if (currentSort[currentIndex].direction === "asc") {
        nextSort = currentSort.map((item, index) =>
          index === currentIndex ? { ...item, direction: "desc" } : item,
        );
      } else {
        nextSort = currentSort.filter((_, index) => index !== currentIndex);
      }

      if (nextSort.length > 0) {
        sortStates.set(tableKey, nextSort);
      } else {
        sortStates.delete(tableKey);
      }
      renderTable(target, headers, rows, options);
    });

    th.appendChild(button);
    headRow.appendChild(th);
  });

  thead.appendChild(headRow);
  table.appendChild(thead);

  const body = document.createElement("tbody");
  displayRows.forEach(({ row, meta }, rowIndex) => {
    const tr = document.createElement("tr");
    const rowKey = getRowKey(row, meta, rowIndex);
    const isRowSelected = selectedRow?.key === rowKey;
    const isRowChecked = checkedKeys.has(rowKey);
    tr.classList.toggle("is-row-selected", isRowSelected);
    tr.classList.toggle("is-row-checked", isRowChecked);
    tr.addEventListener("click", () => {
      const hasCheckedRows = getCheckedRows(tableKey).length > 0;
      const shouldSelectLatest =
        hasCheckedRows &&
        window.confirm(
          "체크된 데이터가 있습니다.\n확인: 체크 해제 후 선택한 행 선택\n취소: 체크 상태 유지",
        );

      if (hasCheckedRows && !shouldSelectLatest) {
        activeSelection = { tableKey, type: "checked" };
        updateActionDock();
        return;
      }

      if (hasCheckedRows) {
        checkedRowsByTable.delete(tableKey);
      }

      setSelectedRow(tableKey, { key: rowKey, row, meta });
      renderTable(target, headers, rows, options);
    });

    const checkTd = document.createElement("td");
    checkTd.className = "check-cell";
    checkTd.addEventListener("click", (event) => event.stopPropagation());
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = isRowChecked;
    checkbox.setAttribute("aria-label", `${row[0]} 선택`);
    checkbox.addEventListener("click", (event) => event.stopPropagation());
    checkbox.addEventListener("change", (event) => {
      const hasSelectedRow = Boolean(getSelectedRow(tableKey));
      const shouldCheckLatest =
        hasSelectedRow &&
        window.confirm(
          "선택된 행이 있습니다.\n확인: 선택 해제 후 체크 작업 수행\n취소: 선택 상태 유지",
        );

      if (hasSelectedRow && !shouldCheckLatest) {
        activeSelection = { tableKey, type: "row" };
        updateActionDock();
        renderTable(target, headers, rows, options);
        return;
      }

      if (hasSelectedRow) {
        selectedRowByTable.delete(tableKey);
      }

      const currentRows = getCheckedRows(tableKey);
      const nextRows = event.target.checked
        ? [...currentRows.filter((item) => item.key !== rowKey), { key: rowKey, row, meta }]
        : currentRows.filter((item) => item.key !== rowKey);
      setCheckedRows(tableKey, nextRows);
      renderTable(target, headers, rows, options);
    });
    checkTd.appendChild(checkbox);
    tr.appendChild(checkTd);

    row.forEach((cell, colIndex) => {
      const td = document.createElement("td");
      td.textContent = cell;
      td.classList.toggle("is-number", isNumericValue(cell));

      if (options.selectable) {
        td.classList.add("is-selectable");
        if (selectedCell.projectId === meta.projectId && selectedCell.col === colIndex) {
          td.classList.add("is-selected");
        }
        td.addEventListener("click", (event) => {
          event.stopPropagation();
          const hasCheckedRows = getCheckedRows(tableKey).length > 0;
          const shouldSelectLatest =
            hasCheckedRows &&
            window.confirm(
              "체크된 데이터가 있습니다.\n확인: 체크 해제 후 선택한 행 선택\n취소: 체크 상태 유지",
            );

          if (hasCheckedRows && !shouldSelectLatest) {
            activeSelection = { tableKey, type: "checked" };
            updateActionDock();
            return;
          }

          if (hasCheckedRows) {
            checkedRowsByTable.delete(tableKey);
          }

          setSelectedRow(tableKey, { key: rowKey, row, meta });
          selectedCell = {
            row: meta.projectIndex ?? rowIndex,
            col: colIndex,
            value: cell,
            projectId: meta.projectId,
          };
          renderSelectableGrid();
          renderCellDetails();
        });
      }

      tr.appendChild(td);
    });
    body.appendChild(tr);
  });

  table.appendChild(body);
  target.replaceChildren(table);
}

function renderCards(target, activeId, onSelect) {
  target.replaceChildren(
    ...projects.map((project) => {
      const button = document.createElement("button");
      button.className = `data-card${project.id === activeId ? " is-active" : ""}`;
      button.type = "button";
      button.innerHTML = `
        <strong>${project.name}</strong>
        <span>${project.id} · ${project.status} · ${project.owner}</span>
      `;
      button.addEventListener("click", () => onSelect(project.id));
      return button;
    }),
  );
}

function renderForm(target, project) {
  const fields = [
    ["프로젝트 ID", project.id],
    ["프로젝트명", project.name],
    ["담당자", project.owner],
    ["상태", project.status],
    ["예산", project.budget],
    ["마감일", project.due],
    ["우선순위", "보통"],
    ["진행률", "72%"],
    ["검토자", "운영팀"],
    ["메모", "입력 대기"],
  ];

  target.replaceChildren(
    ...fields.map(([label, value], index) => {
      const isRequired = index < 2;
      const field = document.createElement("div");
      field.className = `field${isRequired ? " is-required" : ""}`;
      field.innerHTML = `
        <label>${label}${isRequired ? ' <span class="required-mark">*</span>' : ""}</label>
        <input value="${value}" ${isRequired ? "required" : ""} />
      `;
      return field;
    }),
  );
}

function renderGridOnly() {
  renderTable(
    document.querySelector("#grid-only"),
    ["ID", "프로젝트", "담당자", "상태", "예산", "마감일"],
    projects.map((project) => [
      project.id,
      project.name,
      project.owner,
      project.status,
      project.budget,
      project.due,
    ]),
  );
}

function renderCardGrid() {
  renderCards(document.querySelector("#card-grid-list"), selectedCardGridId, (id) => {
    selectedCardGridId = id;
    renderCardGrid();
  });
  renderTable(
    document.querySelector("#card-grid-table"),
    ["코드", "항목", "상태", "완료율"],
    rowsByProject[selectedCardGridId],
  );
}

function renderCardForm() {
  renderCards(document.querySelector("#card-form-list"), selectedCardFormId, (id) => {
    selectedCardFormId = id;
    renderCardForm();
  });
  renderForm(
    document.querySelector("#input-form"),
    projects.find((project) => project.id === selectedCardFormId),
  );
}

function renderSelectableGrid() {
  const selectableRows = projects.map((project) => [
    project.id,
    project.name,
    project.owner,
    project.status,
    project.budget,
    project.due,
  ]);

  renderTable(
    document.querySelector("#selectable-grid"),
    ["ID", "프로젝트", "담당자", "상태", "예산", "마감일"],
    selectableRows,
    {
      selectable: true,
      rowMeta: projects.map((project, projectIndex) => ({
        projectId: project.id,
        projectIndex,
      })),
    },
  );
}

function renderCellDetails() {
  const detailProject =
    projects.find((project) => project.id === selectedCell.projectId) || projects[selectedCell.row];
  renderForm(document.querySelector("#detail-form"), detailProject);

  document.querySelector("#detail-accordion").innerHTML = `
    <details class="accordion-item" open>
      <summary>선택 셀</summary>
      <p>${selectedCell.value}</p>
    </details>
    <details class="accordion-item">
      <summary>기준 행</summary>
      <p>${detailProject.id} / ${detailProject.name} / ${detailProject.owner}</p>
    </details>
    <details class="accordion-item">
      <summary>처리 상태</summary>
      <p>${detailProject.status}, 마감일 ${detailProject.due}</p>
    </details>
  `;

  renderTable(
    document.querySelector("#detail-grid"),
    ["속성", "값"],
    [
      ["선택 셀", selectedCell.value],
      ["행 번호", selectedCell.row + 1],
      ["열 번호", selectedCell.col + 1],
      ["프로젝트 ID", detailProject.id],
      ["담당자", detailProject.owner],
      ["상태", detailProject.status],
    ],
  );
}

const standardSettings = {
  header: { variable: "--header-text-size", defaultValue: 16 },
  grid: { variable: "--grid-text-size", defaultValue: 13 },
  caption: { variable: "--caption-text-size", defaultValue: 12 },
};

function applyStandardSetting(name, value) {
  const setting = standardSettings[name];
  if (!setting) return;

  document.documentElement.style.setProperty(setting.variable, `${value}px`);
  document.querySelectorAll(`[data-setting="${name}"]`).forEach((input) => {
    input.value = value;
  });
  document.querySelectorAll(`[data-setting-number="${name}"]`).forEach((input) => {
    input.value = value;
  });

  const previewRows = document.querySelectorAll(".standard-preview tbody tr");
  const previewIndex = Object.keys(standardSettings).indexOf(name);
  const valueCell = previewRows[previewIndex]?.querySelector("td:last-child");
  if (valueCell) {
    valueCell.textContent = value;
  }
}

function bindStandardSettings() {
  document.querySelectorAll("[data-setting], [data-setting-number]").forEach((input) => {
    input.addEventListener("input", () => {
      const name = input.dataset.setting || input.dataset.settingNumber;
      const min = Number(input.min);
      const max = Number(input.max);
      const rawValue = Number(input.value);
      const value = Math.min(max, Math.max(min, rawValue));

      applyStandardSetting(name, value);
    });
  });

  document.querySelector(".standard-reset").addEventListener("click", () => {
    Object.entries(standardSettings).forEach(([name, setting]) => {
      applyStandardSetting(name, setting.defaultValue);
    });
  });
}

function activatePattern(tabName) {
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === tabName);
  });

  document.querySelectorAll(".lnb-menu a").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.menuTab === tabName);
  });
}

document.querySelectorAll(".lnb-menu a").forEach((menu) => {
  menu.addEventListener("click", (event) => {
    event.preventDefault();
    activatePattern(menu.dataset.menuTab);
  });
});

document.querySelectorAll(".sub-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".sub-tab").forEach((item) => {
      item.classList.toggle("is-active", item === tab);
    });
    document.querySelectorAll(".sub-panel").forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.subPanel === tab.dataset.subTab);
    });
  });
});

document.querySelector(".action-dock").addEventListener("click", (event) => {
  const action = event.target.closest("button")?.dataset.action;
  const selectedRows = getActiveRows();
  if (!action) return;

  if (action === "clear") {
    if (activeSelection) {
      const clearedKey = activeSelection.tableKey;
      clearTableSelection(clearedKey);
      document.querySelectorAll(".data-grid").forEach((grid) => {
        grid.querySelectorAll(".is-row-selected").forEach((row) => row.classList.remove("is-row-selected"));
        grid.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
          checkbox.checked = false;
        });
      });
    }
    return;
  }

  if (action === "delete") {
    updateActionDock(`${selectedRows.length}건 삭제 처리 완료`);
  }

  if (action === "excel") {
    downloadSelectedRows();
  }
});

renderGridOnly();
renderCardGrid();
renderCardForm();
renderSelectableGrid();
renderCellDetails();
bindStandardSettings();
