export function formatCurrency(value) {
  // 后端已经将分转换为元，直接格式化即可
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

export function formatAmountInputValue(value) {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  return Number(value || 0).toFixed(2);
}

export function parseAmountInputValue(value) {
  const normalized = String(value || "").trim().replace(/[^\d.]/g, "");
  if (!normalized) {
    return 0;
  }
  return Math.round(Number(normalized) * 100);
}

export function normalizeAmountInputElement(input) {
  if (!input) return;
  const normalized = String(input.value || "").trim();
  if (!normalized) {
    input.value = "";
    return;
  }
  input.value = formatAmountInputValue(normalized);
}

export function bindAmountInputNormalization(input) {
  if (!input) return;
  input.addEventListener("blur", () => {
    normalizeAmountInputElement(input);
  });
}

export function formatMonth(value) {
  if (!value) return "";
  const date = new Date(`${value}-01T00:00:00`);
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
}

export function formatDateTime(value) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatDateTimeRange(startTime, endTime, durationMinutes) {
  if (!startTime) return "待开始";
  
  const startDate = new Date(startTime);
  const month = String(startDate.getMonth() + 1).padStart(2, "0");
  const day = String(startDate.getDate()).padStart(2, "0");
  const startHours = String(startDate.getHours()).padStart(2, "0");
  const startMinutes = String(startDate.getMinutes()).padStart(2, "0");
  
  // 只有当订单实际有结束时间时才显示结束时间
  if (endTime) {
    const endDate = new Date(endTime);
    const endHours = String(endDate.getHours()).padStart(2, "0");
    const endMinutes = String(endDate.getMinutes()).padStart(2, "0");
    return `${month}/${day} ${startHours}:${startMinutes}-${endHours}:${endMinutes}`;
  } else {
    // 没有结束时间（服务中的订单），只显示日期和开始时间
    return `${month}/${day} ${startHours}:${startMinutes}`;
  }
}

export function toDateTimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

export function getInitial(name = "") {
  return name.trim().slice(0, 1) || "足";
}
