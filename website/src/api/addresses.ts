// Using localStorage to simulate your React Native DB behavior
let ADDRESS_DB: any[] = JSON.parse(localStorage.getItem('user_addresses') || '[]');
const COUNTRY_CODE = "+91";

export const getAddressFromCoords = async (lat: number, lng: number): Promise<string> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
    );
    const data = await response.json();
    return data.display_name || "Unknown Location";
  } catch (error) {
    return "Unknown Location";
  }
};

export const getAddresses = async () => {
  return new Promise((resolve) => {
    const data = JSON.parse(localStorage.getItem('user_addresses') || '[]');
    setTimeout(() => resolve(data), 100);
  });
};

export const addAddress = async (address: any) => {
  return new Promise((resolve) => {
    const current = JSON.parse(localStorage.getItem('user_addresses') || '[]');
    // Prepend country code on backend side
    const newAddress = { 
      ...address, 
      id: Date.now().toString(),
      phone: `${COUNTRY_CODE} ${address.phone}`,
      altPhone: address.altPhone ? `${COUNTRY_CODE} ${address.altPhone}` : ''
    };
    const updated = [...current, newAddress];
    localStorage.setItem('user_addresses', JSON.stringify(updated));
    resolve(newAddress);
  });
};

export const requestOtp = async (phone: string) => {
  return new Promise((resolve) => {
    console.log(`Sending new OTP to ${COUNTRY_CODE}${phone}`);
    setTimeout(() => {
      resolve({ success: true, message: "New OTP Sent" });
    }, 800);
  });
};

export const createOrder = async (orderPayload: any) => {
  try {
    // Validate required fields before sending
    if (!orderPayload.deliveryAddress) {
      return { 
        success: false, 
        error: "Valid delivery address required" 
      };
    }

    if (!orderPayload.items || orderPayload.items.length === 0) {
      return { 
        success: false, 
        error: "Order must contain at least one item" 
      };
    }

    const token = localStorage.getItem("token");
    if (!token) {
      return { 
        success: false, 
        error: "User not authenticated" 
      };
    }

    console.log("ORDER PAYLOAD:", orderPayload);

    const response = await fetch("http://localhost:5000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(orderPayload)
    });

    // Parse the response
    let errorData;
    try {
      const clonedResponse = response.clone();
      const text = await clonedResponse.text();
      if (text) {
        errorData = JSON.parse(text);
      }
    } catch {
      errorData = null;
    }

    if (!response.ok) {
      const errorMessage = errorData?.message || errorData?.error || `Order request failed with status ${response.status}`;
      console.error("API ERROR RESPONSE:", errorData, "Status:", response.status);
      
      // If user not found, clear token and redirect to login
      if (response.status === 401 && errorMessage.includes("User not found")) {
        localStorage.removeItem("jwtToken");
        localStorage.removeItem("user");
        window.location.href = "/";
        return { 
          success: false, 
          error: "Session expired. Please log in again." 
        };
      }
      
      return { 
        success: false, 
        error: errorMessage 
      };
    }

    const data = await response.json();
    console.log("ORDER SUCCESS RESPONSE:", data);

    return {
      success: true,
      orderId: data.orderId || data._id
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Order API error:", errorMessage);
    return { 
      success: false, 
      error: errorMessage 
    };
  }
};