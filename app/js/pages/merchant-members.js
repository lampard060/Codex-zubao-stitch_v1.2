import { ensureMerchantSession } from "../utils/session.js";
import { apiRequest } from "../utils/api.js";
import { formatDateTime } from "../utils/format.js";
import { showFieldFeedback, renderFallback } from "../utils/dom.js";

// 会员等级配置
const MEMBER_LEVELS = [
  { level: 1, name: "普通会员", tagClass: "regular" },
  { level: 2, name: "青铜会员", tagClass: "bronze" },
  { level: 3, name: "白银会员", tagClass: "silver" },
  { level: 4, name: "黄金会员", tagClass: "gold" },
  { level: 5, name: "铂金会员", tagClass: "platinum" },
  { level: 6, name: "钻石会员", tagClass: "diamond" }
];

// 格式化金额（分转元）
function formatCents(cents) {
  return (Number(cents || 0) / 100).toFixed(2);
}

const MEMBER_IMAGES = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuC5KdpBHPt3Gkgpqe3By8osVr9J-HuhTFVO7V6xMjbr80zUpUtgX4aN0a-i8uh8DeZ_bFSIRKxYNveXZBdA6aZsuugi-V3hACc5vEl_d-oAYVkVuJJ9EMDSQT6VlpOqYGC786RBi8UJY9DRancKxwfK8ueDJ3iGTCOXl2UwtHXzaVqyrPR90ALsGdrEKe7E9yyOr7x2FDa9zizlupXSilv2N9xkNY_ns1KXsag9TI1P8Tua0_e172AIjWRTe-M6VHMi3kBrmVPzSRIc",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDHu1WMIEA0SnlVyglmKEHm0hdLUK6sEfQU4z_0zbw1A1vwUEjqX942xj9sN05MBqvvuRXfWOsyi2zwsIjlFr69qmpNNPen-4XVFGryDge35_2i--5FyyFaquLgOCNzYI-F39w9ZjrxhVKvtWE_15LEiaKOTSCcYeJ2wwk3zjuorUBzNZ18GRnZ6BuDm5yPg6jPqihc3r_aJv3DoT9JatwTBkot92QSGHRys6DyiQZ3f-t3u_ct-rutEG_E1xQ4_2PEI0ly37sSPP9A",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBMlTtLkoxnl9JvNfbTkGfdz99msXTJS_MqF2BdU6DvDQmywK4lIX0hDTejahIp66o6R0eNpaQyKymBLMz2-erYd5AjqVXlM_ooeDrKM1328pwcXUrRiBc9y7KlmqEH55cC377CaNBo2T_uxf8c_MwI7Z9E-yWAUnZ9RFuVL4xTqKSsnxqHfigsaOUw0pVHcTEnrVITOha68CuV4AT3E9UzQ0wxpwIJUn90SmskgI8nEc1txFSPozAsxxdjqj57KRj2lEFsNM6GT59y",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAFWK9GvB5WI_FgtZ01dmAVoP8mQF1e5PhT-eWrxZ8JpFI3tRteVY2h_BPEXG5VXszYlYT-xawzKqQlFCgAFsen9motgYeU0FwqyLetbRaPBjBOCO84Lune-eCjVwK51jVq5LkQbzgUcG0Sow1l4MDsAAM6a94xmjpbVE4Na59N-N5RGrhNU-6xhm93eyXHyt-6VQba1LAOsMDdjmKuj0u8e1Vqa7LYjC5_9FcliV3rSLQBQH4HE3CD8pnpgi4nefnTMc7bmjWWpH_9"
];

function renderRecords(container, rows) {
  if (!container) return;
  container.innerHTML = rows.map(([label, value]) => `
    <div class="record-row">
      <div class="small">${label}</div>
      <div>${value}</div>
    </div>
  `).join("");
}

export async function initMerchantMembers() {
  const session = ensureMerchantSession();
  const headers = {
    "x-shop-id": session.shopId,
    "x-user-id": session.user.id
  };
  const data = await apiRequest(`/merchant/customers?shopId=${session.shopId}`, { headers });
  const customers = data.customers || [];
  const list = document.getElementById("member-list");
  const searchInput = document.getElementById("member-search-input");
  const backdrop = document.getElementById("member-sheet-backdrop");
  const panel = document.getElementById("member-detail-panel");
  const nameInput = document.getElementById("member-name-input");
  const phoneInput = document.getElementById("member-phone-input");
  const genderInput = document.getElementById("member-gender-input");
  const levelInput = document.getElementById("member-level-input");
  const noteInput = document.getElementById("member-note-input");
  let editingCustomerId = null;

  function closePanel() {
    panel.hidden = true;
    backdrop.hidden = true;
  }

  function openPanel(customer) {
    editingCustomerId = customer.id;
    const isNew = customer.is_new || customer.id.startsWith("new-");
    nameInput.value = customer.name || "";
    phoneInput.value = customer.phone || "";
    genderInput.value = customer.gender || "";
    levelInput.value = String(customer.member_level || 1);
    noteInput.value = customer.note || "";
    
    // 显示累计消费和累计充值（只在编辑现有会员时显示）
    const statsDisplay = document.getElementById("member-stats-display");
    const totalSpentEl = document.getElementById("member-total-spent");
    const totalRechargedEl = document.getElementById("member-total-recharged");
    
    if (isNew) {
      statsDisplay.hidden = true;
    } else {
      statsDisplay.hidden = false;
      totalSpentEl.textContent = `¥${formatCents(customer.total_spent)}`;
      totalRechargedEl.textContent = `¥${formatCents(customer.total_recharged)}`;
    }
    
    document.getElementById("member-edit-actions").hidden = isNew;
    document.getElementById("member-create-button").hidden = !isNew;
    panel.hidden = false;
    backdrop.hidden = false;
  }

  function renderMembers() {
    const keyword = String(searchInput?.value || "").trim().toLowerCase();
    const filtered = customers.filter((customer) => !keyword || [customer.name, customer.phone].filter(Boolean).join(" ").toLowerCase().includes(keyword));
    if (!filtered.length) {
      renderFallback(list, "当前没有匹配的会员档案。");
      return;
    }
    list.innerHTML = filtered.map((customer, index) => {
      const levelConfig = MEMBER_LEVELS.find(l => l.level === customer.member_level) || MEMBER_LEVELS[0];
      const hasIcon = customer.member_level >= 2;
      return `
      <article class="merchant-member-card">
        <img class="merchant-member-avatar" src="${MEMBER_IMAGES[index % MEMBER_IMAGES.length]}" alt="${customer.name}" />
        <div class="merchant-member-copy">
          <div class="merchant-member-row">
            <h3>${customer.name}</h3>
            <span class="merchant-tier-tag ${levelConfig.tagClass}">
              ${hasIcon ? '<span class="material-symbols-outlined">stars</span>' : ""}
              ${customer.member_level_name || levelConfig.name}
            </span>
          </div>
          <div class="merchant-member-meta">
            <span>${customer.phone || "未留电话"}</span>
            <span>${customer.gender === "male" ? "♂ 男" : customer.gender === "female" ? "♀ 女" : "未设置"}</span>
          </div>
        </div>
        <div class="merchant-member-actions">
          <button class="merchant-member-action" type="button" data-member-open="${customer.id}" aria-label="会员资料">会员资料</button>
          <button class="merchant-member-action" type="button" data-member-records="${customer.id}" aria-label="消费记录">消费记录</button>
        </div>
      </article>
    `}).join("");

    list.querySelectorAll("[data-member-open]").forEach((button) => {
      button.addEventListener("click", () => {
        const customer = customers.find((item) => item.id === button.dataset.memberOpen);
        if (customer) openPanel(customer);
      });
    });

    list.querySelectorAll("[data-member-records]").forEach((button) => {
      button.addEventListener("click", () => {
        window.location.href = `./merchant-member-records.html?customerId=${button.dataset.memberRecords}`;
      });
    });
  }

  searchInput?.addEventListener("input", renderMembers);
  document.getElementById("member-detail-close")?.addEventListener("click", closePanel);
  backdrop?.addEventListener("click", closePanel);

  document.getElementById("member-create-toggle")?.addEventListener("click", () => {
    const newCustomer = {
      id: `new-${Date.now()}`,
      name: "",
      phone: "",
      gender: "",
      member_level: 1,
      note: "",
      is_new: true
    };
    openPanel(newCustomer);
  });

  document.getElementById("member-toggle-button")?.addEventListener("click", async () => {
    if (!editingCustomerId) return;
    const customer = customers.find((item) => item.id === editingCustomerId);
    if (!customer) return;
    
    if (!confirm(`确定要删除会员「${customer.name}」吗？此操作不可撤销。`)) {
      return;
    }
    
    try {
      await apiRequest(`/merchant/customers/${editingCustomerId}?shopId=${session.shopId}`, {
        method: "DELETE",
        headers
      });
      const index = customers.findIndex((item) => item.id === editingCustomerId);
      if (index > -1) {
        customers.splice(index, 1);
      }
      renderMembers();
      closePanel();
    } catch (error) {
      showFieldFeedback("member-feedback", error.message, true);
    }
  });

  document.getElementById("member-save-button")?.addEventListener("click", async () => {
    if (!editingCustomerId) return;
    try {
      showFieldFeedback("member-feedback", "");
      const customer = customers.find((item) => item.id === editingCustomerId);
      
      const body = {
        name: nameInput.value.trim(),
        phone: phoneInput.value.trim(),
        gender: genderInput.value || null,
        memberLevel: Number(levelInput.value),
        note: noteInput.value.trim()
      };

      const result = await apiRequest(`/merchant/customers/${editingCustomerId}?shopId=${session.shopId}`, {
        method: "PUT",
        headers,
        body
      });
      if (customer && result.customer) {
        Object.assign(customer, result.customer);
      }
      
      renderMembers();
      closePanel();
    } catch (error) {
      showFieldFeedback("member-feedback", error.message, true);
    }
  });

  document.getElementById("member-create-button")?.addEventListener("click", async () => {
    if (!editingCustomerId) return;
    try {
      showFieldFeedback("member-feedback", "");
      
      const body = {
        name: nameInput.value.trim(),
        phone: phoneInput.value.trim(),
        gender: genderInput.value || null,
        memberLevel: Number(levelInput.value),
        note: noteInput.value.trim()
      };

      const result = await apiRequest(`/merchant/customers?shopId=${session.shopId}`, {
        method: "POST",
        headers,
        body
      });
      if (result.customer) {
        customers.push(result.customer);
      }
      
      renderMembers();
      closePanel();
    } catch (error) {
      showFieldFeedback("member-feedback", error.message, true);
    }
  });

  renderMembers();
}

export default async function init() {
  await initMerchantMembers();
}
