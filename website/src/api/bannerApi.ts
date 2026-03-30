const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const getBanners = async (tenantId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/banners`, {
      headers: {
        "x-tenant-id": tenantId,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch banners");
    }

    return data.data;
  } catch (error: any) {
    console.error("getBanners error:", error);
    throw error; // ✅ DO NOT hide error
  }
};