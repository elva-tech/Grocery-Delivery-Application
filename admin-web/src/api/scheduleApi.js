import axios from "axios";
import { getTenantId } from "../utils/getTenantId";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://grocery-delivery-application-6n3w.onrender.com",
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("jwtToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers["x-tenant-id"] = getTenantId();
  return config;
});

// GET store status (isOpen, schedule, manualOverride)
export const getSchedule = async () => {
  try {
    const res = await api.get("/api/store/status");
    const data = res.data;
    // Map backend shape to what Schedule.jsx expects
    return {
      isActive:  data.schedule?.openTime != null && !data.manualOverride,
      isOpen:    data.isOpen,
      reason:    data.reason,
      nextChange: data.nextChange,
      schedule:  data.schedule,
      manualOverride: data.manualOverride,
      // Legacy-compat fields used by Schedule.jsx active-schedule display
      type:      "TIME",
      startTime: data.schedule?.openTime
        ? new Date(data.schedule.openTime).toTimeString().slice(0, 5)
        : null,
      endTime: data.schedule?.closeTime
        ? new Date(data.schedule.closeTime).toTimeString().slice(0, 5)
        : null,
    };
  } catch {
    return { isActive: false, isOpen: true };
  }
};

// SAVE schedule  { openTime: ISO, closeTime: ISO }
export const saveSchedule = async (data) => {
  // If isActive: false, caller wants to stop schedule → manual override open
  if (data.isActive === false) {
    await api.patch("/api/store/status", { isOpen: true });
    return { success: true };
  }
  const res = await api.patch("/api/store/schedule", {
    openTime:  data.openTime,
    closeTime: data.closeTime,
  });
  return res.data;
};

// TOGGLE store manually
export const toggleStore = async (isOpen) => {
  const res = await api.patch("/api/store/status", { isOpen });
  return res.data;
};