export const APP_CONFIG = {
  brand: {
    name: "FreshRoot",
    tagline: "Organic Inventory Control",
    logo: "https://cdn-icons-png.flaticon.com/512/2329/2329865.png",
    // We define the brand colors here so the entire app stays consistent
    colors: {
      primary: "#0F2C1D",    // Deep Organic Green
      secondary: "#2F7D4E",  // Mid-tone Green for buttons
      accent: "#D4E7C5",     // Light Leafy Green for highlights
      surface: "#F8FAF8",    // Off-white background
      error: "#DC2626",      // Standard Production Red
    }
  },
  settings: {
    currency: "₹",
    lowStockThreshold: 10,
    categories: [
      "Leafy Greens", 
      "Root Vegetables", 
      "Organic Fruits", 
      "Dairy & Eggs", 
      "Exotic Greens"
    ],
    orderStatuses: ["Placed", "Confirmed", "Out for Delivery", "Delivered"]
  }
};