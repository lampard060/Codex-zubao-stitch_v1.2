function resolveMonthRange(value) {
  const candidateDate = value ? new Date(`${value}-01T00:00:00.000Z`) : new Date();
  const baseDate = Number.isNaN(candidateDate.getTime()) ? new Date() : candidateDate;
  const monthStart = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + 1, 1));

  return {
    monthStart,
    monthEnd,
    monthLabel: monthStart.toISOString().slice(0, 7)
  };
}

function resolveAnalyticsRange(period = "month", value) {
  const now = new Date();

  if (period === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return {
      period: "today",
      rangeStart: start,
      rangeEnd: end,
      label: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`,
      chartMode: "hour"
    };
  }

  if (period === "year") {
    const baseDate = value ? new Date(`${value}-01-01T00:00:00.000Z`) : now;
    const year = Number.isNaN(baseDate.getTime()) ? now.getUTCFullYear() : baseDate.getUTCFullYear();
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));
    return {
      period: "year",
      rangeStart: start,
      rangeEnd: end,
      label: `${year}`,
      chartMode: "month"
    };
  }

  const monthRange = resolveMonthRange(value);
  return {
    period: "month",
    rangeStart: monthRange.monthStart,
    rangeEnd: monthRange.monthEnd,
    label: monthRange.monthLabel,
    chartMode: "week"
  };
}

module.exports = {
  resolveMonthRange,
  resolveAnalyticsRange
};
