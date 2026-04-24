import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://grocery-delivery-application-6n3w.onrender.com",
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("jwtToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.tenantId) config.headers["x-tenant-id"] = payload.tenantId;
    } catch { /* malformed token */ }
  }
  return config;
});

// GET store status (isOpen, schedule, manualOverride)
export const getSchedule = async () => {
  try {
    const res = await api.get("/api/store/status");
    const data = res.data;
    const scheduleType = data.schedule?.type ?? data.type ?? "TIME";

    return {
      isActive:       data.schedule?.openTime != null && !data.manualOverride,
      isOpen:         data.isOpen,
      reason:         data.reason ?? "",
      nextChange:     data.nextChange ?? null,
      schedule:       data.schedule,
      manualOverride: data.manualOverride,
      type:           scheduleType,

      // TIME fields — HH:MM for the inputs
      startTime: data.schedule?.openTime
        ? new Date(data.schedule.openTime).toTimeString().slice(0, 5)
        : null,
      endTime: data.schedule?.closeTime
        ? new Date(data.schedule.closeTime).toTimeString().slice(0, 5)
        : null,

      // DATE fields — full ISO for date inputs
      startDate: data.schedule?.startDate
        ? new Date(data.schedule.startDate).toISOString().slice(0, 10)
        : null,
      endDate: data.schedule?.endDate
        ? new Date(data.schedule.endDate).toISOString().slice(0, 10)
        : null,
    };
  } catch {
    return { isActive: false, isOpen: true };
  }
};

// SAVE schedule  { openTime: ISO, closeTime: ISO }
export const saveSchedule = async (data) => {
  if (data.isActive === false) {
    await api.patch("/api/store/status", { isOpen: true });
    return { success: true };
  }
  const res = await api.patch("/api/store/schedule", {
    openTime:  data.openTime,
    closeTime: data.closeTime,
    type:      data.type      ?? "TIME",
    reason:    data.reason    ?? "",
    startDate: data.startDate ?? null,
    endDate:   data.endDate   ?? null,
  });
  return res.data;
};

// TOGGLE store manually
export const toggleStore = async (isOpen) => {
  const res = await api.patch("/api/store/status", { isOpen });
  return res.data;
};