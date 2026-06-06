import { ensureMerchantSession } from "../utils/session.js";
import { apiRequest } from "../utils/api.js";
import { showFieldFeedback, renderFallback } from "../utils/dom.js";

const ROOM_IMAGES = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCOmAqOizuf2XHThtbtTm7Ei46xFSs6vaM3PVFO8iPf8ue7ABr_o_W70FvyvNUmWRTb5YEnlQZnkPFM0Z8-NW80QRcuG8PhkQS0jC2XbOzbbsqVEnFqSpL-QEOaGa3yQH4YBXRv2B054TERGyYu4I0xY209tdbf4mtcAfucRd69zmgRbLM6ag5P-8Lamp-rT_IgeOI3-_XzkJMj8wLu1RlJG4insSSz05kwYpE2zib0Fc_dkxARxDbMHelvH46iv5rarmkjhi84wRrf",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAXP25i8aiIoUzaLfGNtlKcAoctRti4MM4pBkgQHRQL8ul37oqvayi7uGFL4j02OqPa64JlHkETtc3866YhM6BlBijdd4QRc1EH4odVgMx7yKgv7cavOpcXu4GpiKom5Gmyl6DbC1FK_OVdloKua9U6zTKqRbDxw_FNsmiJHOVDHZzekczsQ5_QhqmZeB4PP5JWrY4l39ZIk3Yp10xGXmtKH06qz--EA5githKxfii_JPjWvxvcDc5qM56FfK8ytCyxhzFezh79J9rB",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBgWkI2FM0mE02wIPkLCCMfhDenf-ecXLegVdjxBAxflmFgQcHJjTSjKHyyB4AZATmt3PWC92ibpwvTLGxFZ7us-n0IHA7U0R1rqLFWb7mfLH3ERet2tSjE0p3dtBvkBizOK1oObZfbsJI9jTxqEvMemK5GvrAwHBvoLYy36vbuAAeQDiM1gTfBTDRwTk_RIbFv2DdgAdwwNiJDo1OtdzHT_teLg6mgjeUVtnQQlQWqHp3FTZbkNYe4ZBXfOyIPcSYxd-N3Vj4qAWkt",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCRdSrHQyF_9waA3jEXattiXncXwMbaRnMEWyPeEIwQmNgiP8a9BQcgyOmE5wac2HsuQ99yGs0R-yfSBj-ZNKKya-9STXzO4gNDmRnKlGxYJzB_j5ioG665uNN5whRjVOogFpL7XXmUimMTXtzAZTD6ncCxsJEBTVF0k_E5Lckk8P8niIp-jANZu4eXpG2Z42n3tjAfqKxMQD8rlEahDK5OzHQksc0fO19OyCJA3DOQ4_9oApgq1gutbTOlXknbQvgoawY0Bj85GWz3",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDgSOqv1fB4KCNyUUHbH6lhgSMj-FSc-MOWj-zdo9B7TMDoPaRKkE5Q6Yti1XFPSr9Wfa07gOLIBiJTPkKpouOgWhLziAwmtqkiQljPCYt5DzbD5pUJLp8Aw9ODF_rThwe9nKfUOi5Yxy1L-WPkyrDGIX7638NR050X0FrPQXo-HiTTI2qmnPrY4vVOm3BMjQgCMi-RFx2BKXC2UfCPAjjLgThQl0EhmrIMWC97h2MahSzXZok1Jq7udLGA8uz2kfTTnRiELeoRTJS-"
];

export async function initMerchantRooms() {
  const session = ensureMerchantSession();
  const headers = {
    "x-shop-id": session.shopId,
    "x-user-id": session.user.id
  };
  const data = await apiRequest(`/merchant/rooms?shopId=${session.shopId}`, { headers });
  const rooms = data.rooms || [];
  const list = document.getElementById("room-card-list");
  const backdrop = document.getElementById("room-sheet-backdrop");
  const panel = document.getElementById("room-edit-panel");
  const title = document.getElementById("room-sheet-title");
  const nameInput = document.getElementById("room-name-input");
  const typeInput = document.getElementById("room-type-input");
  const noteInput = document.getElementById("room-note-input");
  let editingId = null;

  function closePanel() {
    panel.hidden = true;
    backdrop.hidden = true;
  }

  function openPanel(room = null) {
    editingId = room?.id || null;
    title.textContent = room ? "房间详情" : "新增房间";
    nameInput.value = room?.name || "";
    typeInput.value = room?.room_type || "";
    noteInput.value = room?.note || "";
    document.getElementById("room-edit-actions").hidden = !room;
    document.getElementById("room-create-button").hidden = !!room;
    panel.hidden = false;
    backdrop.hidden = false;
  }

  function renderRooms() {
    if (!rooms.length) {
      renderFallback(list, "当前还没有房间资料。");
      return;
    }
    list.innerHTML = rooms.map((room, index) => {
      const isBusy = room.is_busy;
      const status = room.is_active ? (isBusy ? "已占用" : "可用") : "服务中";
      const action = room.is_active ? (isBusy ? "管理" : "详情") : "管理";
      return `
        <article class="merchant-room-card ${isBusy ? "soft" : ""}">
          <div class="merchant-room-thumb">
            <img src="${ROOM_IMAGES[index % ROOM_IMAGES.length]}" alt="${room.name}" />
          </div>
          <div class="merchant-room-copy">
            <h3>${room.name}</h3>
            <p class="room-capacity">接待位：${room.room_type || "未设置"}</p>
            ${room.note ? `<p class="room-note">${room.note}</p>` : ""}
          </div>
          <div class="merchant-room-side">
            <span class="merchant-room-status ${status === "可用" ? "available" : "busy"}">${status}</span>
            <button class="merchant-room-link button-reset" type="button" data-room-open="${room.id}">${action}</button>
          </div>
        </article>
      `;
    }).join("");

    list.querySelectorAll("[data-room-open]").forEach((button) => {
      button.addEventListener("click", () => {
        const room = rooms.find((entry) => entry.id === button.dataset.roomOpen);
        if (room) openPanel(room);
      });
    });
  }

  document.getElementById("room-create-toggle")?.addEventListener("click", () => openPanel());
  document.getElementById("room-edit-close")?.addEventListener("click", closePanel);
  backdrop?.addEventListener("click", closePanel);

  document.getElementById("room-toggle-button")?.addEventListener("click", async () => {
    if (!editingId) return;
    const room = rooms.find((entry) => entry.id === editingId);
    if (!room) return;
    
    if (!confirm(`确定要删除房间「${room.name}」吗？此操作不可撤销。`)) {
      return;
    }
    
    try {
      await apiRequest(`/merchant/rooms/${editingId}?shopId=${session.shopId}`, {
        method: "DELETE",
        headers
      });
      const index = rooms.findIndex((entry) => entry.id === editingId);
      if (index > -1) {
        rooms.splice(index, 1);
      }
      renderRooms();
      closePanel();
    } catch (error) {
      showFieldFeedback("room-feedback", error.message, true);
    }
  });

  document.getElementById("room-save-button")?.addEventListener("click", async () => {
    if (!editingId) return;
    try {
      showFieldFeedback("room-feedback", "");
      const body = {
        name: nameInput.value.trim(),
        roomType: typeInput.value.trim(),
        note: noteInput.value.trim()
      };
      const result = await apiRequest(`/merchant/rooms/${editingId}?shopId=${session.shopId}`, { method: "PATCH", headers, body });
      const target = rooms.find((entry) => entry.id === editingId);
      if (target) Object.assign(target, result.room || {});
      renderRooms();
      closePanel();
    } catch (error) {
      showFieldFeedback("room-feedback", error.message, true);
    }
  });

  document.getElementById("room-create-button")?.addEventListener("click", async () => {
    try {
      showFieldFeedback("room-feedback", "");
      const body = {
        name: nameInput.value.trim(),
        roomType: typeInput.value.trim(),
        note: noteInput.value.trim()
      };
      const result = await apiRequest(`/merchant/rooms?shopId=${session.shopId}`, { method: "POST", headers, body });
      if (result.room) {
        rooms.unshift(result.room);
      }
      renderRooms();
      closePanel();
    } catch (error) {
      showFieldFeedback("room-feedback", error.message, true);
    }
  });

  renderRooms();
}

export default async function init() {
  await initMerchantRooms();
}
