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
const pageSizesByTable = new Map();
const editStatesByTable = new Map();
const hiddenCardsByList = new Map();
let activeCardModal = null;
let activeSelection = null;
let activePatternName = "gridInput";

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

function isSameSingleCheckedRow(tableKey, rowKey) {
  const checkedRows = getCheckedRows(tableKey);
  return checkedRows.length === 1 && checkedRows[0].key === rowKey;
}

function shouldConfirmRowSelection(tableKey, rowKey) {
  const checkedRows = getCheckedRows(tableKey);
  if (checkedRows.length === 0) return false;
  return !isSameSingleCheckedRow(tableKey, rowKey);
}

function shouldConfirmCheckSelection(tableKey, rowKey) {
  const selectedRow = getSelectedRow(tableKey);
  if (!selectedRow) return false;
  return selectedRow.key !== rowKey;
}

function confirmLatestSelection(message) {
  return window.confirm(message);
}

function clearTableSelection(tableKey) {
  checkedRowsByTable.delete(tableKey);
  selectedRowByTable.delete(tableKey);
  if (activeSelection?.tableKey === tableKey) {
    activeSelection = null;
  }
  updateActionDock();
}

function getPanelForTable(tableKey) {
  return document.querySelector(`#${tableKey}`)?.closest(".tab-panel") || null;
}

function isSelectionInActivePattern(selection = activeSelection) {
  if (!selection) return false;
  return getPanelForTable(selection.tableKey)?.dataset.panel === activePatternName;
}

function refreshActiveSelectionForPattern() {
  if (isSelectionInActivePattern()) {
    updateActionDock();
    return;
  }

  const activePanel = document.querySelector(`.tab-panel[data-panel="${activePatternName}"]`);
  const tableFrame = activePanel?.querySelector(".grid-frame[data-table-key]");
  const tableKey = tableFrame?.dataset.tableKey;

  if (!tableKey) {
    activeSelection = null;
    updateActionDock();
    return;
  }

  if (getCheckedRows(tableKey).length > 0) {
    activeSelection = { tableKey, type: "checked" };
  } else if (getSelectedRow(tableKey)) {
    activeSelection = { tableKey, type: "row" };
  } else {
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

function focusGridDraftInput(tableKey) {
  requestAnimationFrame(() => {
    const input = document.querySelector(`[data-table-key="${tableKey}"] .grid-edit-input`);
    input?.focus();
  });
}

function focusCardModalInput() {
  requestAnimationFrame(() => {
    const input = document.querySelector('[data-card-modal] input[name="id"]');
    input?.focus();
  });
}

function renderTable(target, headers, rows, options = {}) {
  const tableKey = getTableKey(target);
  const sortState = sortStates.get(tableKey) || [];
  const pageSize = pageSizesByTable.get(tableKey) || 10;
  const editState = editStatesByTable.get(tableKey) || null;
  const requiredColumns = options.requiredColumns || [0, 1];
  const showActions = options.showActions !== false;
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

  const visibleRows = displayRows.slice(0, pageSize);

  const tableFrame = document.createElement("div");
  tableFrame.className = "grid-frame";
  tableFrame.dataset.tableKey = tableKey;

  const toolbar = document.createElement("div");
  toolbar.className = "grid-toolbar";
  toolbar.innerHTML = `
    <label class="page-size-control">
      <span>몇 개씩 보기</span>
      <select aria-label="몇 개씩 보기">
        <option value="10">10개</option>
        <option value="20">20개</option>
        <option value="50">50개</option>
        <option value="100">100개</option>
      </select>
    </label>
    <div class="grid-actions">
      <button type="button" data-grid-action="new">신규</button>
      <button type="button" data-grid-action="edit">편집</button>
      <button type="button" data-grid-action="cancel">취소</button>
      <button type="button" data-grid-action="save">저장</button>
    </div>
  `;

  const pageSizeSelect = toolbar.querySelector("select");
  pageSizeSelect.value = String(pageSize);
  pageSizeSelect.addEventListener("change", () => {
    pageSizesByTable.set(tableKey, Number(pageSizeSelect.value));
    renderTable(target, headers, rows, options);
  });

  const newButton = toolbar.querySelector('[data-grid-action="new"]');
  const editButton = toolbar.querySelector('[data-grid-action="edit"]');
  const cancelButton = toolbar.querySelector('[data-grid-action="cancel"]');
  const saveButton = toolbar.querySelector('[data-grid-action="save"]');
  if (!showActions) {
    toolbar.querySelector(".grid-actions").remove();
  } else {
    editButton.disabled = !selectedRow;
    cancelButton.disabled = !editState;
    saveButton.disabled = !editState;
    newButton.addEventListener("click", () => {
      editStatesByTable.set(tableKey, {
        mode: "new",
        row: headers.map(() => ""),
      });
      renderTable(target, headers, rows, options);
      focusGridDraftInput(tableKey);
    });
    editButton.addEventListener("click", () => {
      const row = getSelectedRow(tableKey);
      if (!row) return;
      editStatesByTable.set(tableKey, {
        key: row.key,
        mode: "edit",
        row: [...row.row],
      });
      renderTable(target, headers, rows, options);
      focusGridDraftInput(tableKey);
    });
    cancelButton.addEventListener("click", () => {
      if (!editStatesByTable.has(tableKey)) return;
      editStatesByTable.delete(tableKey);
      renderTable(target, headers, rows, options);
    });
    saveButton.addEventListener("click", () => {
      if (!editStatesByTable.has(tableKey)) return;
      const currentEditState = editStatesByTable.get(tableKey);
      const missingRequiredFields = requiredColumns
        .filter((columnIndex) => !String(currentEditState.row[columnIndex] || "").trim())
        .map((columnIndex) => headers[columnIndex]);

      if (missingRequiredFields.length > 0) {
        window.alert(`${missingRequiredFields.join(", ")} 필드는 필수 입력 항목입니다. 입력하시기 바랍니다.`);
        focusGridDraftInput(tableKey);
        return;
      }

      const mode = currentEditState.mode;
      editStatesByTable.delete(tableKey);
      window.alert(mode === "new" ? "신규 행 저장 처리 완료" : "편집 행 저장 처리 완료");
      renderTable(target, headers, rows, options);
    });
  }

  tableFrame.appendChild(toolbar);

  const table = document.createElement("table");
  table.className = "data-grid";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");

  const checkTh = document.createElement("th");
  checkTh.className = "check-cell";
  checkTh.innerHTML = `<input type="checkbox" aria-label="전체 행 선택" />`;
  const headerCheckbox = checkTh.querySelector("input");
  headerCheckbox.checked = visibleRows.length > 0 && visibleRows.every(({ row, meta }, index) =>
    checkedKeys.has(getRowKey(row, meta, index)),
  );
  headerCheckbox.addEventListener("change", () => {
    const isCheckingAll = headerCheckbox.checked;
    const hasSelectedRow = Boolean(getSelectedRow(tableKey));
    const shouldCheckLatest =
      isCheckingAll &&
      hasSelectedRow &&
      confirmLatestSelection(
        "선택된 행이 있습니다.\n확인: 선택 해제 후 체크 작업 수행\n취소: 선택 상태 유지",
      );

    if (isCheckingAll && hasSelectedRow && !shouldCheckLatest) {
      activeSelection = { tableKey, type: "row" };
      updateActionDock();
      renderTable(target, headers, rows, options);
      return;
    }

    if (isCheckingAll && hasSelectedRow) {
      selectedRowByTable.delete(tableKey);
    }

    const nextRows = headerCheckbox.checked
      ? visibleRows.map(({ row, meta }, index) => ({
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
    const requiredMark = requiredColumns.includes(columnIndex) ? ' <span class="required-mark">*</span>' : "";

    button.className = "sort-button";
    button.type = "button";
    button.innerHTML = `
      <span>${header}${requiredMark}</span>
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
  visibleRows.forEach(({ row, meta }, rowIndex) => {
    const tr = document.createElement("tr");
    const rowKey = getRowKey(row, meta, rowIndex);
    const isRowSelected = selectedRow?.key === rowKey;
    const isRowChecked = checkedKeys.has(rowKey);
    tr.classList.toggle("is-row-selected", isRowSelected);
    tr.classList.toggle("is-row-checked", isRowChecked);
    tr.classList.toggle("is-editing", editState?.mode === "edit" && editState.key === rowKey);
    tr.addEventListener("click", () => {
      const needsConfirmation = shouldConfirmRowSelection(tableKey, rowKey);
      const shouldSelectLatest =
        needsConfirmation &&
        confirmLatestSelection(
          "체크된 데이터가 있습니다.\n확인: 체크 해제 후 선택한 행 선택\n취소: 체크 상태 유지",
        );

      if (needsConfirmation && !shouldSelectLatest) {
        activeSelection = { tableKey, type: "checked" };
        updateActionDock();
        return;
      }

      if (needsConfirmation) {
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
      const isChecking = event.target.checked;
      const needsConfirmation = isChecking && shouldConfirmCheckSelection(tableKey, rowKey);
      const shouldCheckLatest =
        needsConfirmation &&
        confirmLatestSelection(
          "선택된 행이 있습니다.\n확인: 선택 해제 후 체크 작업 수행\n취소: 선택 상태 유지",
        );

      if (needsConfirmation && !shouldCheckLatest) {
        activeSelection = { tableKey, type: "row" };
        updateActionDock();
        renderTable(target, headers, rows, options);
        return;
      }

      if (needsConfirmation) {
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
      td.classList.toggle("is-number", isNumericValue(cell));

      if (editState?.mode === "edit" && editState.key === rowKey) {
        const input = document.createElement("input");
        input.className = "grid-edit-input";
        input.value = editState.row[colIndex] || "";
        input.addEventListener("click", (event) => event.stopPropagation());
        input.addEventListener("input", () => {
          editState.row[colIndex] = input.value;
        });
        td.replaceChildren(input);
        tr.appendChild(td);
        return;
      }

      td.textContent = cell;

      if (options.selectable) {
        td.classList.add("is-selectable");
        if (selectedCell.projectId === meta.projectId && selectedCell.col === colIndex) {
          td.classList.add("is-selected");
        }
        td.addEventListener("click", (event) => {
          event.stopPropagation();
          const needsConfirmation = shouldConfirmRowSelection(tableKey, rowKey);
          const shouldSelectLatest =
            needsConfirmation &&
            confirmLatestSelection(
              "체크된 데이터가 있습니다.\n확인: 체크 해제 후 선택한 행 선택\n취소: 체크 상태 유지",
            );

          if (needsConfirmation && !shouldSelectLatest) {
            activeSelection = { tableKey, type: "checked" };
            updateActionDock();
            return;
          }

          if (needsConfirmation) {
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

  if (editState?.mode === "new") {
    const tr = document.createElement("tr");
    tr.className = "is-editing is-new-row";

    const checkTd = document.createElement("td");
    checkTd.className = "check-cell";
    checkTd.innerHTML = `<span class="new-row-badge">신규</span>`;
    tr.appendChild(checkTd);

    headers.forEach((header, colIndex) => {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.className = "grid-edit-input";
      input.placeholder = `${header} 입력`;
      input.value = editState.row[colIndex] || "";
      input.addEventListener("click", (event) => event.stopPropagation());
      input.addEventListener("input", () => {
        editState.row[colIndex] = input.value;
      });
      td.appendChild(input);
      tr.appendChild(td);
    });

    body.appendChild(tr);
  }

  table.appendChild(body);
  tableFrame.appendChild(table);
  target.replaceChildren(tableFrame);
}

function renderCards(target, activeId, onSelect) {
  const listKey = target.id;
  const hiddenCards = hiddenCardsByList.get(listKey) || new Set();
  const visibleProjects = projects.filter((project) => !hiddenCards.has(project.id));

  target.replaceChildren(
    createCardToolbar(target, activeId, onSelect),
    ...visibleProjects.map((project) => createCardItem(project, activeId, onSelect)),
  );
}

function createCardToolbar(target, activeId, onSelect) {
  const listKey = target.id;
  const toolbar = document.createElement("div");
  toolbar.className = "card-toolbar";
  toolbar.innerHTML = `
    <div class="card-actions">
      <button type="button" data-card-action="new">신규</button>
      <button type="button" data-card-action="edit">편집</button>
      <button type="button" data-card-action="cancel">취소</button>
      <button type="button" data-card-action="delete">삭제</button>
    </div>
  `;

  const newButton = toolbar.querySelector('[data-card-action="new"]');
  const editButton = toolbar.querySelector('[data-card-action="edit"]');
  const cancelButton = toolbar.querySelector('[data-card-action="cancel"]');
  const deleteButton = toolbar.querySelector('[data-card-action="delete"]');

  editButton.disabled = !activeId;
  cancelButton.disabled = !activeCardModal || activeCardModal.listKey !== listKey;
  deleteButton.disabled = !activeId;

  newButton.addEventListener("click", () => {
    openCardModal({ mode: "new", listKey, target, activeId, onSelect });
  });

  editButton.addEventListener("click", () => {
    const project = projects.find((item) => item.id === activeId);
    if (!project) return;
    openCardModal({
      mode: "edit",
      listKey,
      projectId: project.id,
      target,
      activeId,
      onSelect,
      values: {
        id: project.id,
        name: project.name,
        status: project.status,
        owner: project.owner,
      },
    });
  });

  cancelButton.addEventListener("click", () => {
    closeCardModal();
    renderCards(target, activeId, onSelect);
  });

  deleteButton.addEventListener("click", () => {
    if (!activeId) return;
    if (!window.confirm(`${activeId} 카드를 삭제하시겠습니까?`)) return;
    const nextHiddenCards = new Set(hiddenCardsByList.get(listKey) || []);
    nextHiddenCards.add(activeId);
    hiddenCardsByList.set(listKey, nextHiddenCards);
    const nextProject = projects.find((project) => !nextHiddenCards.has(project.id));
    if (nextProject) {
      onSelect(nextProject.id);
    } else {
      renderCards(target, activeId, onSelect);
    }
  });

  return toolbar;
}

function createCardItem(project, activeId, onSelect) {
  const button = document.createElement("button");
  button.className = `data-card${project.id === activeId ? " is-active" : ""}`;
  button.type = "button";
  button.innerHTML = `
    <strong>${project.name}</strong>
    <span>${project.id} · ${project.status} · ${project.owner}</span>
  `;
  button.addEventListener("click", () => onSelect(project.id));
  return button;
}

function openCardModal(config) {
  const modal = document.querySelector("[data-card-modal]");
  const title = document.querySelector("#card-modal-title");
  const form = document.querySelector(".card-modal-form");
  const values = config.values || { id: "", name: "", status: "", owner: "" };

  activeCardModal = config;
  title.textContent = config.mode === "new" ? "카드 신규" : "카드 편집";
  form.elements.id.value = values.id;
  form.elements.name.value = values.name;
  form.elements.status.value = values.status;
  form.elements.owner.value = values.owner;
  renderCardModalExtra(config);
  modal.hidden = false;
  focusCardModalInput();
}

function renderCardModalExtra(config) {
  const extra = document.querySelector("[data-modal-extra]");
  const projectId = config.projectId || selectedCardGridId || selectedCardFormId || projects[0].id;

  if (config.listKey === "card-grid-list") {
    const rows = rowsByProject[projectId] || rowsByProject[projects[0].id];
    extra.className = "modal-extra modal-extra-grid";
    extra.innerHTML = `
      <table class="data-grid modal-mini-grid">
        <thead>
          <tr>
            <th>코드</th>
            <th>항목</th>
            <th>상태</th>
            <th>완료율</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  <td><input value="${row[0]}" /></td>
                  <td><input value="${row[1]}" /></td>
                  <td><input value="${row[2]}" /></td>
                  <td><input value="${row[3]}" /></td>
                </tr>
              `,
            )
            .join("")}
          <tr class="is-new-row">
            <td><input placeholder="코드 입력" /></td>
            <td><input placeholder="항목 입력" /></td>
            <td><input placeholder="상태 입력" /></td>
            <td><input placeholder="완료율 입력" /></td>
          </tr>
        </tbody>
      </table>
    `;
    return;
  }

  const project = projects.find((item) => item.id === projectId) || projects[0];
  const fields = [
    ["우선순위", "보통"],
    ["진행률", "72%"],
    ["검토자", "운영팀"],
    ["마감일", project.due],
    ["예산", project.budget],
    ["메모", "입력 대기"],
  ];

  extra.className = "modal-extra modal-extra-form";
  extra.innerHTML = fields
    .map(
      ([label, value]) => `
        <div class="field">
          <label>${label}</label>
          <input value="${value}" />
        </div>
      `,
    )
    .join("");
}

function closeCardModal() {
  document.querySelector("[data-card-modal]").hidden = true;
  activeCardModal = null;
}

function bindCardModal() {
  const modal = document.querySelector("[data-card-modal]");
  const form = document.querySelector(".card-modal-form");

  modal.querySelector(".modal-close").addEventListener("click", closeCardModal);
  modal.querySelector('[data-modal-action="cancel"]').addEventListener("click", closeCardModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeCardModal();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!activeCardModal) return;

    const id = form.elements.id.value.trim();
    const name = form.elements.name.value.trim();
    const missing = [];

    if (!id) missing.push("카드 ID");
    if (!name) missing.push("카드명");

    if (missing.length > 0) {
      window.alert(`${missing.join(", ")} 필드는 필수 입력 항목입니다. 입력하시기 바랍니다.`);
      focusCardModalInput();
      return;
    }

    const message = activeCardModal.mode === "new" ? "카드 신규 저장 처리 완료" : "카드 편집 저장 처리 완료";
    window.alert(message);
    const { target, activeId, onSelect } = activeCardModal;
    closeCardModal();
    renderCards(target, activeId, onSelect);
  });
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

function getProjectRows() {
  return projects.map((project) => [
    project.id,
    project.name,
    project.owner,
    project.status,
    project.budget,
    project.due,
  ]);
}

function renderGridInput() {
  renderTable(
    document.querySelector("#grid-input"),
    ["ID", "프로젝트", "담당자", "상태", "예산", "마감일"],
    getProjectRows(),
  );
}

function renderGridView() {
  renderTable(
    document.querySelector("#grid-view"),
    ["ID", "프로젝트", "담당자", "상태", "예산", "마감일"],
    getProjectRows(),
    { showActions: false },
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
  activePatternName = tabName;

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === tabName);
  });

  document.querySelectorAll(".lnb-menu a").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.menuTab === tabName);
  });

  refreshActiveSelectionForPattern();
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
        grid.querySelectorAll(".is-row-checked").forEach((row) => row.classList.remove("is-row-checked"));
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

renderGridInput();
renderGridView();
renderCardGrid();
renderCardForm();
renderSelectableGrid();
renderCellDetails();
bindStandardSettings();
bindCardModal();
