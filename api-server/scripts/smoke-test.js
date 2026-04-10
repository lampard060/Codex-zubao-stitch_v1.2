const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(process.cwd(), ".env")
});

const baseUrl = process.env.API_URL || "http://127.0.0.1:3001";
const shopId = "30000000-0000-0000-0000-000000000001";
const technicianUserId = "20000000-0000-0000-0000-000000000001";

async function request(url, options = {}) {
  const response = await fetch(`${baseUrl}${url}`, options);
  const data = await response.json();
  return {
    status: response.status,
    data
  };
}

async function main() {
  const login = await request("/api/v1/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      phone: "13800000001",
      password: "Zubao123!"
    })
  });

  if (login.status !== 200 || !login.data?.data?.token) {
    throw new Error(`Login failed: ${JSON.stringify(login)}`);
  }

  const token = login.data.data.token;
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "x-shop-id": shopId,
    "x-user-id": "10000000-0000-0000-0000-000000000001"
  };

  const dashboard = await request(`/api/v1/merchant/dashboard?shopId=${shopId}`, {
    headers: authHeaders
  });

  const orderOptionsBefore = await request(`/api/v1/merchant/order-options?shopId=${shopId}`, {
    headers: authHeaders
  });

  const firstServiceItem = await request(`/api/v1/merchant/service-items?shopId=${shopId}`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "足底按摩",
      description: "足底舒缓放松",
      serviceMode: "scheduled",
      listPrice: 39800,
      durationMinutes: 60
    })
  });

  const secondServiceItem = await request(`/api/v1/merchant/service-items?shopId=${shopId}`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "中医经络推拿",
      description: "经络调理放松",
      serviceMode: "designated",
      listPrice: 46800,
      durationMinutes: 75
    })
  });

  const firstRoom = await request(`/api/v1/merchant/rooms?shopId=${shopId}`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "V108",
      roomType: "豪华间",
      note: "靠窗"
    })
  });

  const secondRoom = await request(`/api/v1/merchant/rooms?shopId=${shopId}`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "V109",
      roomType: "标准间",
      note: "安静区"
    })
  });

  const customer = await request(`/api/v1/merchant/customers?shopId=${shopId}`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "张先生",
      phone: "13800138000",
      gender: "male",
      isMember: true,
      note: "偏好轻力度"
    })
  });

  const createdOrder = await request(`/api/v1/merchant/orders?shopId=${shopId}`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      technicianUserId,
      serviceItemId: firstServiceItem.data?.data?.serviceItem?.id,
      roomId: firstRoom.data?.data?.room?.id,
      customerId: customer.data?.data?.customer?.id,
      customerType: "registered",
      startTime: new Date().toISOString(),
      note: "首次到店"
    })
  });

  const editedOrder = await request(`/api/v1/merchant/orders/${createdOrder.data?.data?.order?.id}?shopId=${shopId}`, {
    method: "PATCH",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      technicianUserId,
      serviceItemId: secondServiceItem.data?.data?.serviceItem?.id,
      roomId: secondRoom.data?.data?.room?.id,
      customerType: "walk_in",
      customerId: null,
      startTime: new Date().toISOString(),
      note: "改为散客订单"
    })
  });

  const completedOrder = await request(`/api/v1/merchant/orders/${createdOrder.data?.data?.order?.id}/complete?shopId=${shopId}`, {
    method: "PATCH",
    headers: authHeaders
  });

  const orders = await request(`/api/v1/merchant/orders?shopId=${shopId}`, {
    headers: authHeaders
  });

  const payrollRuleUpdate = await request(`/api/v1/merchant/payroll/rules/default?shopId=${shopId}`, {
    method: "PUT",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      baseSalary: 300000,
      designatedBonusAmount: 12000,
      scheduledCommissionRate: 0.35,
      designatedCommissionRate: 0.45
    })
  });

  const payroll = await request(`/api/v1/merchant/payroll/summaries?shopId=${shopId}`, {
    headers: authHeaders
  });

  const technicianHome = await request(`/api/v1/technician/home?technicianUserId=${technicianUserId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-technician-user-id": technicianUserId
    }
  });

  console.log(JSON.stringify({
    loginStatus: login.status,
    dashboardStatus: dashboard.status,
    dashboardOk: dashboard.data?.ok,
    initialServiceItemCount: orderOptionsBefore.data?.data?.serviceItems?.length || 0,
    initialRoomCount: orderOptionsBefore.data?.data?.rooms?.length || 0,
    initialCustomerCount: orderOptionsBefore.data?.data?.customers?.length || 0,
    serviceItemCreateStatus: firstServiceItem.status,
    roomCreateStatus: firstRoom.status,
    customerCreateStatus: customer.status,
    orderCreateStatus: createdOrder.status,
    createdOrderAmount: createdOrder.data?.data?.order?.actual_amount || null,
    orderEditStatus: editedOrder.status,
    editedOrderType: editedOrder.data?.data?.order?.order_type || null,
    editedCustomerType: editedOrder.data?.data?.order?.customer_type || null,
    orderCompleteStatus: completedOrder.status,
    orderCount: orders.data?.data?.orders?.length || 0,
    finalOrderStatus: orders.data?.data?.orders?.[0]?.status || null,
    payrollRuleStatus: payrollRuleUpdate.status,
    payrollCount: payroll.data?.data?.summaries?.length || 0,
    technicianHomeStatus: technicianHome.status,
    technicianName: technicianHome.data?.data?.profile?.name || null
  }, null, 2));
}

main().catch((error) => {
  console.error("[smoke-test]", error.message);
  process.exit(1);
});
