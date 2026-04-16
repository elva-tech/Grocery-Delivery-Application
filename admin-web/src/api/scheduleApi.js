// MOCK DB
let scheduleDB = {
  type: null,
  startTime: null,
  endTime: null,
  startDate: null,
  endDate: null,
  reason: "",
  isActive: false
};

// SAVE
export const saveSchedule = async (data) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      scheduleDB = {
        type: data.type || null,
        startTime: data.startTime || null,
        endTime: data.endTime || null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        reason: data.reason || "",
        isActive: false
      };

      resolve({ success: true });
    }, 300);
  });
};

// GET
export const getSchedule = async () => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(scheduleDB), 300);
  });
};

// CHECK LOGIC
export const isStoreClosed = (schedule) => {
  if (!schedule || !schedule.isActive) return false;

  const now = new Date();

  // TIME BASED
  if (schedule.type === "TIME") {
    if (!schedule.startTime || !schedule.endTime) return false;

    const current = now.getHours() * 60 + now.getMinutes();

    const startParts = schedule.startTime.split(':');
    const endParts = schedule.endTime.split(':');

    const start = Number(startParts[0]) * 60 + Number(startParts[1]);
    const end = Number(endParts[0]) * 60 + Number(endParts[1]);

    if (start < end) {
      return current >= start && current <= end;
    } else {
      return current >= start || current <= end;
    }
  }

  // DATE BASED
  if (schedule.type === "DATE") {
    if (!schedule.startDate || !schedule.endDate) return false;

    const start = new Date(schedule.startDate);
    const end = new Date(schedule.endDate);

    return now >= start && now <= end;
  }

  return false;
};