// src/config/appConfig.js
export const APP_CONFIG = {
  brand: {
    name: 'Enandi', // Change this here to update the whole dashboard
    colors: {
      primary: '#1A4D2E',
    }
  }
};

export const MOCK_CATEGORIES = [
  // MAIN PILLARS
  { id: 'cat_dairy', name: 'Dairy', icon: 'water-outline', image: ['https://tse1.mm.bing.net/th/id/OIP.PiQ06zHaAA2cJ4kMnJRxSQHaGL?pid=Api&P=0&h=180'], parentId: null },
  { id: 'cat_agarbathis', name: 'Agarbathis', icon: 'flame-outline', image: ['https://tse3.mm.bing.net/th/id/OIP.oh2jMLVRDfdRHdTcEg43YAHaE8?pid=Api&P=0&h=180'], parentId: null },
  { id: 'cat_dryfruits', name: 'Dry Fruits', icon: 'leaf-outline', image: ['https://tse2.mm.bing.net/th/id/OIP._DG7k_H47fUscE0o4LKX3QHaEK?pid=Api&P=0&h=180'], parentId: null },

  // DAIRY SUB-CATEGORIES
  { id: 'sub_milk', parentId: 'cat_dairy', name: 'Milk', icon: 'water', image: ['https://tse1.mm.bing.net/th/id/OIP.PiQ06zHaAA2cJ4kMnJRxSQHaGL?pid=Api&P=0&h=180'] },
  { id: 'sub_curd', parentId: 'cat_dairy', name: 'Curd & Yogurt', icon: 'ice-cream', image: ['https://tse3.mm.bing.net/th/id/OIP.Vmvg1SWcx3sJAUbjRw73TgHaHa?pid=Api&P=0&h=180'] },
  { id: 'sub_butter', parentId: 'cat_dairy', name: 'Butter & Ghee', icon: 'flame', image: ['https://tse1.mm.bing.net/th/id/OIP.2S6bJGikSHzyFRtJOO0K7AHaE3?pid=Api&P=0&h=180'] },
  { id: 'sub_paneer', parentId: 'cat_dairy', name: 'Paneer', icon: 'cube', image: ['https://images.unsplash.com/photo-1631452180519-c014fe946bc7'] },
  { id: 'sub_cheese', parentId: 'cat_dairy', name: 'Cheese', icon: 'pizza', image: ['https://tse2.mm.bing.net/th/id/OIP.EnsGWvO4GrNoOCvnTBjf0QHaFL?pid=Api&P=0&h=180'] },

  // AGARBATHIS SUB-CATEGORIES
  { id: 'sub_scented', parentId: 'cat_agarbathis', name: 'Scented', icon: 'flower', image: ['https://images.unsplash.com/photo-1618221195710-dd6b41faaea6'] },
  { id: 'sub_dhoop', parentId: 'cat_agarbathis', name: 'Dhoop', icon: 'cloud', image: ['https://images.unsplash.com/photo-1621939514649-280e2ee25f60'] },

  // DRY FRUITS SUB-CATEGORIES
  { id: 'sub_almonds', parentId: 'cat_dryfruits', name: 'Almonds', icon: 'nutrition', image: ['https://images.unsplash.com/photo-1615484478243-c94e896edbae'] },
  { id: 'sub_cashews', parentId: 'cat_dryfruits', name: 'Cashews', icon: 'nutrition', image: ['https://images.unsplash.com/photo-1606313564200-e75d5e30476c'] },
];

export const MOCK_PRODUCTS = [
  // --- DAIRY ---
  { id: 1, parentCategoryId: 'cat_dairy', subCategoryId: 'sub_milk', name: 'Nandini Toned Milk (500ml)', price: 24, stock: 500, status: 'Active', images: ['https://images.unsplash.com/photo-1550583724-125581f770d3?auto=format&fit=crop&q=80&w=800'] },
  { id: 2, parentCategoryId: 'cat_dairy', subCategoryId: 'sub_milk', name: 'Nandini Full Cream (1L)', price: 50, stock: 200, status: 'Active', images: ['https://images.unsplash.com/photo-1563636619-e91001933565?auto=format&fit=crop&q=80&w=800'] },
  { id: 4, parentCategoryId: 'cat_dairy', subCategoryId: 'sub_curd', name: 'Nandini Curd (200g)', price: 12, stock: 300, status: 'Active', images: ['https://images.unsplash.com/photo-1571212515416-fef01fc43637?auto=format&fit=crop&q=80&w=800'] },
  { id: 7, parentCategoryId: 'cat_dairy', subCategoryId: 'sub_solids', name: 'Nandini Ghee (500ml)', price: 310, stock: 100, status: 'Active', images: ['https://images.unsplash.com/photo-1589927986089-35812388d1f4?auto=format&fit=crop&q=80&w=800'] },
  { id: 13, parentCategoryId: 'cat_dairy', subCategoryId: 'sub_icecream', name: 'Nandini Vanilla Tub (1L)', price: 180, stock: 20, status: 'Active', images: ['https://images.unsplash.com/photo-1501443762994-82bd5dace89a?auto=format&fit=crop&q=80&w=800'] },

  // --- AGARBATHIS ---
  { id: 201, parentCategoryId: 'cat_agarbathis', subCategoryId: 'sub_scented', name: 'Sandalwood Premium Box', price: 150, stock: 100, status: 'Active', images: ['https://images.unsplash.com/photo-1612538498456-e861df91d4d0?auto=format&fit=crop&q=80&w=800'] },
  { id: 202, parentCategoryId: 'cat_agarbathis', subCategoryId: 'sub_scented', name: 'Mogra Special Sticks', price: 95, stock: 150, status: 'Active', images: ['https://images.unsplash.com/photo-1602928321679-560bb453f190?auto=format&fit=crop&q=80&w=800'] },
  // DHOOP 
  { id: 210, parentCategoryId: 'cat_agarbathis', subCategoryId: 'sub_dhoop', name: 'Gugal Dhoop Cups', price: 120, stock: 80, status: 'Active', images: ['https://plus.unsplash.com/premium_photo-1679092415124-76677f985012?auto=format&fit=crop&q=80&w=800'] },
  { id: 211, parentCategoryId: 'cat_agarbathis', subCategoryId: 'sub_dhoop', name: 'Wet Dhoop Sticks (Black)', price: 60, stock: 200, status: 'Active', images: ['https://images.unsplash.com/photo-1621259020580-f04b1cc70966?auto=format&fit=crop&q=80&w=800'] },

  // --- DRY FRUITS ---
  { id: 301, parentCategoryId: 'cat_dryfruits', subCategoryId: 'sub_almonds', name: 'Premium Almonds (500g)', price: 450, stock: 50, status: 'Active', images: ['https://images.unsplash.com/photo-1508061253366-f7da158b6d46?auto=format&fit=crop&q=80&w=800'] },
  // CASHEWS 
  { id: 310, parentCategoryId: 'cat_dryfruits', subCategoryId: 'sub_cashews', name: 'W240 Whole Cashews (250g)', price: 320, stock: 100, status: 'Active', images: ['https://images.unsplash.com/photo-1536628218484-8258b99c856b?auto=format&fit=crop&q=80&w=800'] },
  { id: 311, parentCategoryId: 'cat_dryfruits', subCategoryId: 'sub_cashews', name: 'Roasted Salted Cashews', price: 180, stock: 150, status: 'Active', images: ['https://images.unsplash.com/photo-1593343360634-9214e21a8f90?auto=format&fit=crop&q=80&w=800'] },
  // WALNUTS 
  { id: 320, parentCategoryId: 'cat_dryfruits', subCategoryId: 'sub_walnuts', name: 'Chilean Walnuts (Inshell)', price: 550, stock: 30, status: 'Active', images: ['https://images.unsplash.com/photo-1552345387-f8364f33777d?auto=format&fit=crop&q=80&w=800'] },
  { id: 321, parentCategoryId: 'cat_dryfruits', subCategoryId: 'sub_walnuts', name: 'Premium Walnut Kernels', price: 890, stock: 25, status: 'Active', images: ['https://images.unsplash.com/photo-1621511202874-124b89ca0528?auto=format&fit=crop&q=80&w=800'] }
];
export const MOCK_RETURNS = [
  {
    id: 'RET-1001',
    orderId: 'ORD000123',
    customerName: 'John Doe',
    reason: 'Item damaged',
    comment: 'The milk carton was leaking inside the bag.',
    status: 'PENDING', 
    date: new Date().toISOString(),
    amount: 120,
    evidence: 'https://images.unsplash.com/photo-1628102422620-234c3a0b948a?q=80&w=400', // Mock evidence image
  }
];
export const MOCK_ORDERS = [
  { 
    id: 'ORD-101', customerName: 'Rahul Sharma', 
    address: { full: 'H-24, Lajpat Nagar, New Delhi', label: 'Home', phone: '+91 98765 43210', altPhone: '+91 90000 11111', landmark: 'Near Central Market' },
    items: [{ name: 'Nandini Toned Milk', quantity: 2, price: 24 }], 
    totalAmount: 48, status: 'PLACED', date: '2026-01-14', assignment: 'Pending' 
  },
  { 
    id: 'ORD-102', customerName: 'Priya Patel', 
    address: { full: 'A-402, Satellite Towers, Ahmedabad', label: 'Office', phone: '+91 88888 77777', landmark: 'Opposite ISRO' },
    items: [{ name: 'Nandini Ghee', quantity: 1, price: 310 }], 
    totalAmount: 310, status: 'CONFIRMED', date: '2026-01-14', assignment: 'Needs Rider' 
  },
  { 
    id: 'ORD-103', customerName: 'Amitav Ghosh', 
    address: { full: 'Block C, Salt Lake City, Kolkata', label: 'Home', phone: '+91 77777 66666', landmark: 'Near City Centre' },
    items: [{ name: 'Nandini Peda', quantity: 1, price: 120 }], 
    totalAmount: 120, status: 'DELIVERED', date: '2026-01-13', assignment: 'Amit Patel' 
  },
  { 
    id: 'ORD-104', customerName: 'Siddharth Nair', 
    address: { full: '12th Main, Indiranagar, Bengaluru', label: 'Home', phone: '+91 99999 00000', landmark: 'Behind Toit Brewery' },
    items: [{ name: 'Vanilla Tub', quantity: 2, price: 180 }], 
    totalAmount: 360, status: 'PLACED', date: '2026-01-14', assignment: 'Pending' 
  },
  { 
    id: 'ORD-105', customerName: 'Meenakshi Iyer', 
    address: { full: 'Flat 12B, Mylapore Heights, Chennai', label: 'Home', phone: '+91 94444 55555', landmark: 'Near Kapaleeshwarar Temple' },
    items: [{ name: 'Curd 500g', quantity: 2, price: 28 }], 
    totalAmount: 56, status: 'CONFIRMED', date: '2026-01-14', assignment: 'Needs Rider' 
  },
  { 
    id: 'ORD-106', customerName: 'Vikram Malhotra', 
    address: { full: 'Oberoi Enclave, Juhu, Mumbai', label: 'Work', phone: '+91 92222 33333', landmark: 'Beside JW Marriott' },
    items: [{ name: 'Sandalwood Premium', quantity: 3, price: 150 }], 
    totalAmount: 450, status: 'PLACED', date: '2026-01-14', assignment: 'Pending' 
  },
  { 
    id: 'ORD-107', customerName: 'Ananya Reddy', 
    address: { full: 'Road No. 45, Jubilee Hills, Hyderabad', label: 'Home', phone: '+91 95555 66666', landmark: 'Near Apollo Hospital' },
    items: [{ name: 'Premium Almonds', quantity: 1, price: 450 }], 
    totalAmount: 450, status: 'CANCELLED', date: '2026-01-13', assignment: 'None' 
  },
  { 
    id: 'ORD-108', customerName: 'Kabir Singh', 
    address: { full: 'Sector 15, Chandigarh', label: 'Other', phone: '+91 97777 88888', landmark: 'Near DAV College' },
    items: [{ name: 'Nandini Milk (1L)', quantity: 4, price: 50 }], 
    totalAmount: 200, status: 'PLACED', date: '2026-01-14', assignment: 'Pending' 
  },
  { 
    id: 'ORD-109', customerName: 'Surbhi Gupta', 
    address: { full: 'Malviya Nagar, Jaipur', label: 'Home', phone: '+91 96666 77777', landmark: 'GT Mall Circle' },
    items: [{ name: 'Ghee 500ml', quantity: 2, price: 310 }], 
    totalAmount: 620, status: 'CONFIRMED', date: '2026-01-14', assignment: 'Needs Rider' 
  },
  { 
    id: 'ORD-110', customerName: 'Arjun Verma', 
    address: { full: 'Civil Lines, Lucknow', label: 'Office', phone: '+91 91111 22222', landmark: 'Near Governor House' },
    items: [{ name: 'Nandini Peda', quantity: 1, price: 120 }], 
    totalAmount: 120, status: 'DELIVERED', date: '2026-01-12', assignment: 'Sunny Singh' 
  },
  { 
    id: 'ORD-111', customerName: 'Deepa Rao', 
    address: { full: 'Prabhat Road, Pune', label: 'Home', phone: '+91 93333 44444', landmark: 'Near Film Institute' },
    items: [{ name: 'Nandini Homogenized Milk', quantity: 3, price: 26 }], 
    totalAmount: 78, status: 'PLACED', date: '2026-01-14', assignment: 'Pending' 
  }
];

export const MOCK_RIDERS = [
  { id: 101, name: 'Amit Patel', phone: '+91 98765-43210', vehicle: 'Bike', status: 'Online', activeOrders: 1 },
  { id: 102, name: 'Sunny Singh', phone: '+91 88776-55443', vehicle: 'Scooter', status: 'Online', activeOrders: 1 },
  { id: 103, name: 'Ravi Kumar', phone: '+91 77665-55442', vehicle: 'Bike', status: 'Offline', activeOrders: 0 }
];

export const MOCK_BANNERS = [
  { id: '1', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1200', title: 'Premium Dry Fruits' },
  { id: '2', image: 'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?q=80&w=1200', title: 'Fresh Dairy Daily' }
];