const RECORDS_DATA = [
  { id: "1", service: "足底按摩", amount: 298, date: "2026-04-28 14:30", status: "completed" },
  { id: "2", service: "全身精油SPA", amount: 598, date: "2026-04-25 16:00", status: "completed" },
  { id: "3", service: "中式推拿", amount: 398, date: "2026-04-20 11:00", status: "completed" },
  { id: "4", service: "拔罐理疗", amount: 168, date: "2026-04-15 19:30", status: "completed" },
  { id: "5", service: "足底按摩+加钟", amount: 448, date: "2026-04-10 15:00", status: "completed" },
];

export async function initMerchantMemberRecords() {
  const list = document.getElementById("member-records-list");

  if (!RECORDS_DATA.length) {
    list.innerHTML = '<div class="mobile-empty-state"><span class="material-symbols-outlined">receipt_long</span><p>暂无消费记录</p></div>';
    return;
  }

  list.innerHTML = RECORDS_DATA.map((record) => `
    <article class="merchant-record-card">
      <div class="merchant-record-copy">
        <h3>${record.service}</h3>
        <p>${record.date}</p>
      </div>
      <div class="merchant-record-amount">
        <span class="mobile-status-pill success">已完成</span>
        <strong>¥${record.amount}.00</strong>
      </div>
    </article>
  `).join("");
}

export default async function init() {
  await initMerchantMemberRecords();
}