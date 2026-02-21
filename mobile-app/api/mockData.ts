export const APP_CONFIG = {
  brandName: "Enandi",
  // This will be a URL string in the future, for now it matches your local path logic
  logoUrl: null 
};


// ================= FIXED MOCKDATA (PRODUCTION-SAFE) =================

export const MOCK_CATEGORIES = [
  // ================= MAIN PILLARS =================
  {
    id: 'cat_dairy',
    name: 'Dairy',
    icon: 'water-outline',
    image: ['https://tse1.mm.bing.net/th/id/OIP.PiQ06zHaAA2cJ4kMnJRxSQHaGL?pid=Api&P=0&h=180'],
    parentId: null,
  },
  {
    id: 'cat_agarbathis',
    name: 'Agarbathis',
    icon: 'flame-outline',
    image: ['https://tse3.mm.bing.net/th/id/OIP.oh2jMLVRDfdRHdTcEg43YAHaE8?pid=Api&P=0&h=180'],
    parentId: null,
  },
  {
    id: 'cat_dryfruits',
    name: 'Dry Fruits',
    icon: 'leaf-outline',
    image: ['https://tse2.mm.bing.net/th/id/OIP._DG7k_H47fUscE0o4LKX3QHaEK?pid=Api&P=0&h=180'],
    parentId: null,
  },

  // ================= DAIRY SUB-CATEGORIES =================
  { id: 'sub_milk', parentId: 'cat_dairy', name: 'Milk', icon: 'water', image: ['https://tse1.mm.bing.net/th/id/OIP.PiQ06zHaAA2cJ4kMnJRxSQHaGL?pid=Api&P=0&h=180'] },
  { id: 'sub_curd', parentId: 'cat_dairy', name: 'Curd & Yogurt', icon: 'ice-cream', image: ['https://tse3.mm.bing.net/th/id/OIP.Vmvg1SWcx3sJAUbjRw73TgHaHa?pid=Api&P=0&h=180'] },
  { id: 'sub_butter', parentId: 'cat_dairy', name: 'Butter & Ghee', icon: 'flame', image: ['https://tse1.mm.bing.net/th/id/OIP.2S6bJGikSHzyFRtJOO0K7AHaE3?pid=Api&P=0&h=180'] },
  { id: 'sub_paneer', parentId: 'cat_dairy', name: 'Paneer', icon: 'cube', image: ['https://images.unsplash.com/photo-1631452180519-c014fe946bc7'] },
  { id: 'sub_cheese', parentId: 'cat_dairy', name: 'Cheese', icon: 'pizza', image: ['https://tse2.mm.bing.net/th/id/OIP.EnsGWvO4GrNoOCvnTBjf0QHaFL?pid=Api&P=0&h=180'] },
  { id: 'sub_cream', parentId: 'cat_dairy', name: 'Cream', icon: 'snow', image: ['https://tse4.mm.bing.net/th/id/OIP.7uWaBNtqvmMM4gd2ltyMXgHaP0?pid=Api&P=0&h=180'] },
  { id: 'sub_buttermilk', parentId: 'cat_dairy', name: 'Buttermilk', icon: 'beer', image: ['https://tse3.mm.bing.net/th/id/OIP.IrOcLaKPetrfhnCcA1AFBwAAAA?pid=Api&P=0&h=180'] },

  // ================= AGARBATHIS =================
  { id: 'sub_scented', parentId: 'cat_agarbathis', name: 'Scented', icon: 'flower', image: ['https://images.unsplash.com/photo-1618221195710-dd6b41faaea6'] },
  { id: 'sub_dhoop', parentId: 'cat_agarbathis', name: 'Dhoop', icon: 'cloud', image: ['https://images.unsplash.com/photo-1621939514649-280e2ee25f60'] },

  // ================= DRY FRUITS =================
  { id: 'sub_almonds', parentId: 'cat_dryfruits', name: 'Almonds', icon: 'nutrition', image: ['https://images.unsplash.com/photo-1615484478243-c94e896edbae'] },
  { id: 'sub_cashews', parentId: 'cat_dryfruits', name: 'Cashews', icon: 'nutrition', image: ['https://images.unsplash.com/photo-1606313564200-e75d5e30476c'] },
];




export const MOCK_PRODUCTS = [
  /* ================= MILK ================= */
  {
    id: 'p1',
    parentCategoryId: 'cat_dairy',
    subCategoryId: 'sub_milk',
    name: 'Farm Fresh Buffalo Milk',
    price: 85,
    unit: '1 Litre',
    stock: 15,
    description: 'Rich, creamy, and 100% pure buffalo milk. High in fat content and perfect for making thick curd or traditional Indian sweets.',
    image: ['https://tse1.mm.bing.net/th/id/OIP.PiQ06zHaAA2cJ4kMnJRxSQHaGL?pid=Api&P=0&h=180', 'https://tse1.mm.bing.net/th/id/OIP.PiQ06zHaAA2cJ4kMnJRxSQHaGL?pid=Api&P=0&h=180'],
  },
  {
    id: 'p2',
    parentCategoryId: 'cat_dairy',
    subCategoryId: 'sub_milk',
    name: 'Pure Cow Milk',
    price: 68,
    unit: '1 Litre',
    stock: 5,
    image: ['https://tse1.mm.bing.net/th/id/OIP.PiQ06zHaAA2cJ4kMnJRxSQHaGL?pid=Api&P=0&h=180'],
  },
  {
    id: 'p3',
    parentCategoryId: 'cat_dairy',
    subCategoryId: 'sub_milk',
    name: 'Low Fat Skimmed Milk',
    price: 60,
    unit: '500ml',
    stock: 25,
    image: ['https://tse1.mm.bing.net/th/id/OIP.PiQ06zHaAA2cJ4kMnJRxSQHaGL?pid=Api&P=0&h=180'],
  },
  {
    id: 'p8',
    parentCategoryId: 'cat_dairy',
    subCategoryId: 'sub_milk',
    name: 'Full Cream Milk',
    price: 72,
    unit: '1 Litre',
    stock: 18,
    image: ['https://tse1.mm.bing.net/th/id/OIP.Pn_OhRaUi9IUEbPIViSyIAHaHX?pid=Api&P=0&h=180'],
  },
  {
    id: 'p9',
    parentCategoryId: 'cat_dairy',
    subCategoryId: 'sub_milk',
    name: 'Organic Cow Milk',
    price: 95,
    unit: '1 Litre',
    stock: 10,
    image: ['https://tse3.mm.bing.net/th/id/OIP.yqVEMd7EhndvvViIHsGxYwHaHa?pid=Api&P=0&h=180'],
  },

  /* ================= CURD & YOGURT ================= */
  {
    id: 'p4',
    parentCategoryId: 'cat_dairy',
    subCategoryId: 'sub_curd',
    name: 'Premium Set Curd',
    price: 45,
    unit: '500g',
    stock: 20,
    image: ['https://tse3.mm.bing.net/th/id/OIP.Vmvg1SWcx3sJAUbjRw73TgHaHa?pid=Api&P=0&h=180'],
  },
  {
    id: 'p5',
    parentCategoryId: 'cat_dairy',
    subCategoryId: 'sub_curd',
    name: 'Greek Yogurt (Plain)',
    price: 120,
    unit: '200g',
    stock: 12,
    image: ['https://tse3.mm.bing.net/th/id/OIP.QTEdO8dnU083A9mEs7NuoAHaHa?pid=Api&P=0&h=180'],
  },
  {
    id: 'p10',
    parentCategoryId: 'cat_dairy',
    subCategoryId: 'sub_curd',
    name: 'Probiotic Curd',
    price: 55,
    unit: '400g',
    stock: 14,
    image: ['https://tse2.mm.bing.net/th/id/OIP.VUk_9tdZo1HNMlJhWm_ntwAAAA?pid=Api&P=0&h=180'],
  },
  {
    id: 'p11',
    parentCategoryId: 'cat_dairy',
    subCategoryId: 'sub_curd',
    name: 'Strawberry Yogurt',
    price: 65,
    unit: '150g',
    stock: 9,
    image: ['https://tse2.mm.bing.net/th/id/OIP.VUk_9tdZo1HNMlJhWm_ntwAAAA?pid=Api&P=0&h=180'],
  },

  /* ================= BUTTER & GHEE ================= */
  {
    id: 'p12',
    parentCategoryId: 'cat_dairy',
    subCategoryId: 'sub_butter',
    name: 'Desi Cow Ghee',
    price: 550,
    unit: '500ml',
    stock: 6,
    image: ['https://images.unsplash.com/photo-1589985270826-4b7bf1a507df?q=80&w=800'],
  },
  {
    id: 'p13',
    parentCategoryId: 'cat_dairy',
    subCategoryId: 'sub_butter',
    name: 'Organic Butter',
    price: 180,
    unit: '200g',
    stock: 11,
    image: ['https://tse1.mm.bing.net/th/id/OIP.2S6bJGikSHzyFRtJOO0K7AHaE3?pid=Api&P=0&h=180'],
  },
  {
    id: 'p14',
    parentCategoryId: 'cat_dairy',
    subCategoryId: 'sub_butter',
    name: 'Salted Butter',
    price: 95,
    unit: '100g',
    stock: 20,
    image: ['https://tse1.mm.bing.net/th/id/OIP.2S6bJGikSHzyFRtJOO0K7AHaE3?pid=Api&P=0&h=180'],
  },

  /* ================= PANEER ================= */
  {
    id: 'p6',
    parentCategoryId: 'cat_dairy',
    subCategoryId: 'sub_paneer',
    name: 'Fresh Malai Paneer',
    price: 110,
    unit: '200g',
    stock: 10,
    image: ['https://tse1.mm.bing.net/th/id/OIP.GFLOoTwBivIeMGk7aUVR7gHaJp?pid=Api&P=0&h=180'],
  },
  {
    id: 'p7',
    parentCategoryId: 'cat_dairy',
    subCategoryId: 'sub_paneer',
    name: 'Diced Paneer Cubes',
    price: 210,
    unit: '500g',
    stock: 8,
    image: ['https://images.unsplash.com/photo-1631452180519-c014fe946bc7?q=80&w=800'],
  },
  {
    id: 'p15',
    parentCategoryId: 'cat_dairy',
    subCategoryId: 'sub_paneer',
    name: 'Low Fat Paneer',
    price: 130,
    unit: '200g',
    stock: 12,
    image: ['https://images.unsplash.com/photo-1625944525533-473f1b32f1d5?q=80&w=800'],
  },

  /* ================= CHEESE ================= */
  {
    id: 'p16',
    parentCategoryId: 'cat_dairy',
    subCategoryId: 'sub_cheese',
    name: 'Cheddar Cheese Block',
    price: 220,
    unit: '200g',
    stock: 7,
    image: ['https://tse2.mm.bing.net/th/id/OIP.EnsGWvO4GrNoOCvnTBjf0QHaFL?pid=Api&P=0&h=180'],
  },
  {
    id: 'p17',
    parentCategoryId: 'cat_dairy',
    subCategoryId: 'sub_cheese',
    name: 'Mozzarella Cheese',
    price: 180,
    unit: '200g',
    stock: 10,
    image: ['https://tse2.mm.bing.net/th/id/OIP.EnsGWvO4GrNoOCvnTBjf0QHaFL?pid=Api&P=0&h=180'],
  },

  /* ================= CREAM ================= */
  {
    id: 'p18',
    parentCategoryId: 'cat_dairy',
    subCategoryId: 'sub_cream',
    name: 'Fresh Dairy Cream',
    price: 90,
    unit: '200ml',
    stock: 13,
    image: ['https://tse4.mm.bing.net/th/id/OIP.7uWaBNtqvmMM4gd2ltyMXgHaP0?pid=Api&P=0&h=180'],
  },

  /* ================= BUTTERMILK ================= */
  {
    id: 'p19',
    parentCategoryId: 'cat_dairy',
    subCategoryId: 'sub_buttermilk',
    name: 'Spiced Buttermilk',
    price: 25,
    unit: '250ml',
    stock: 30,
    image: ['https://tse1.mm.bing.net/th/id/OIP.tw-eUxnpC88rehHg_xiHlAAAAA?pid=Api&P=0&h=180'],
  },
  {
    id: 'p20',
    parentCategoryId: 'cat_dairy',
    subCategoryId: 'sub_buttermilk',
    name: 'Classic Buttermilk',
    price: 22,
    unit: '250ml',
    stock: 40,
    image: ['https://tse3.mm.bing.net/th/id/OIP.IrOcLaKPetrfhnCcA1AFBwAAAA?pid=Api&P=0&h=180'],
  },

  
  /* ================= AGARBATHIS ================= */
  {
    id: 'p201',
    parentCategoryId: 'cat_agarbathis',
    subCategoryId: 'sub_scented',
    name: 'Sandalwood Agarbathi',
    price: 150,
    unit: '1 Box',
    stock: 100,
    image: ['https://images.unsplash.com/photo-1612538498456-e861df91d4d0?auto=format&fit=crop&q=80&w=800'],
  },
  {
    id: 'p202',
    parentCategoryId: 'cat_agarbathis',
    subCategoryId: 'sub_scented',
    name: 'Rose Fragrance Agarbathi',
    price: 120,
    unit: '1 Box',
    stock: 80,
    image: ['https://images.unsplash.com/photo-1622036881156-0fca2a1b61bf?auto=format&fit=crop&q=80&w=800'],
  },
  {
    id: 'p203',
    parentCategoryId: 'cat_agarbathis',
    subCategoryId: 'sub_dhoop',
    name: 'Guggal Dhoop Cups',
    price: 130,
    unit: '12 Cups',
    stock: 60,
    image: ['https://plus.unsplash.com/premium_photo-1679092415124-76677f985012?auto=format&fit=crop&q=80&w=800'],
  },
  {
    id: 'p204',
    parentCategoryId: 'cat_agarbathis',
    subCategoryId: 'sub_dhoop',
    name: 'Sambrani Dhoop',
    price: 95,
    unit: '100g',
    stock: 45,
    image: ['https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&q=80&w=800'],
  },

  /* ================= DRY FRUITS ================= */
  {
    id: 'p301',
    parentCategoryId: 'cat_dryfruits',
    subCategoryId: 'sub_almonds',
    name: 'Premium California Almonds',
    price: 450,
    unit: '500g',
    stock: 50,
    image: ['https://images.unsplash.com/photo-1508061253366-f7da158b6d46?auto=format&fit=crop&q=80&w=800'],
  },
  {
    id: 'p302',
    parentCategoryId: 'cat_dryfruits',
    subCategoryId: 'sub_almonds',
    name: 'Organic Raw Almonds',
    price: 520,
    unit: '500g',
    stock: 35,
    image: ['https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&q=80&w=800'],
  },
  {
    id: 'p303',
    parentCategoryId: 'cat_dryfruits',
    subCategoryId: 'sub_cashews',
    name: 'W240 Whole Cashews',
    price: 320,
    unit: '250g',
    stock: 100,
    image: ['https://images.unsplash.com/photo-1536628218484-8258b99c856b?auto=format&fit=crop&q=80&w=800'],
  },
  {
    id: 'p304',
    parentCategoryId: 'cat_dryfruits',
    subCategoryId: 'sub_cashews',
    name: 'Premium Split Cashews',
    price: 280,
    unit: '250g',
    stock: 70,
    image: ['https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&q=80&w=800'],
  },
];

export const MOCK_ORDERS = [
  {
    id: 'ORD001',
    userId: 'user-123',
    status: 'DELIVERED',
    createdAt: '2026-01-20T08:30:00',
    deliverySlot: '7-10 AM',
    address: 'Flat 204, Koramangala, Bengaluru',
    totalAmount: 245,
    items: [
      { id: 'p1', name: 'Farm Fresh Buffalo Milk', price: 85, quantity: 2, unit: '1 Litre', image: ['https://images.unsplash.com/photo-1563636619-e91000f21fca?q=80&w=800'] },
      { id: 'p4', name: 'Premium Set Curd', price: 45, quantity: 1, unit: '500g', image: ['https://images.unsplash.com/photo-1485962391905-dc37bcd2c73c?q=80&w=800'] },
    ]
  },
  /* --- TEST CASE: REFUND APPROVED --- */
  {
    id: 'ORD_TEST_OK',
    userId: 'user-123',
    status: 'REFUND_APPROVED',
    createdAt: '2026-02-20T10:00:00',
    deliverySlot: '7-10 AM',
    address: 'TEST HOUSE, Sector 5, Bengaluru',
    totalAmount: 310,
    adminComment: 'We have approved your refund for the leaked Ghee jar. The amount will reflect in your bank in 3-5 days.',
    resolvedAt: '2026-02-20T14:00:00',
    items: [
      { id: 'p12', name: 'Desi Cow Ghee', price: 310, quantity: 1, unit: '500ml', image: 'https://images.unsplash.com/photo-1615485291234-9e7e1f6b7c7c' }
    ]
  },
  /* --- TEST CASE: REFUND REJECTED --- */
  {
    id: 'ORD_TEST_NO',
    userId: 'user-123',
    status: 'REFUND_REJECTED',
    createdAt: '2026-02-20T11:00:00',
    deliverySlot: '7-10 AM',
    address: 'TEST HOUSE, Sector 5, Bengaluru',
    totalAmount: 44,
    adminComment: 'Request denied. The evidence photo shows a tampered seal from the customer side.',
    resolvedAt: '2026-02-20T15:00:00',
    items: [
      { id: 'p20', name: 'Classic Buttermilk', price: 22, quantity: 2, unit: '250ml', image: 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60' }
    ]
  },
   {

    id: 'ORD002',

    userId: 'user-123',

    status: 'OUT_FOR_DELIVERY',

    createdAt: '2026-01-26T06:15:00',

    deliverySlot: '7-10 AM',

    address: 'Flat 204, Green Valley Apartments, Koramangala, Bengaluru',

    totalAmount: 340,

    items: [

      { id: 'p6', name: 'Fresh Malai Paneer', price: 110, quantity: 2, unit: '200g', image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7' },

      { id: 'p13', name: 'Organic Butter', price: 180, quantity: 1, unit: '200g', image: 'https://images.unsplash.com/photo-1589987607627-616cac5c11b1' }

    ]

  },

  {

    id: 'ORD003',

    userId: 'user-123',

    status: 'CONFIRMED',

    createdAt: '2026-01-27T07:45:00',

    deliverySlot: '10 AM - 1 PM',

    address: 'Flat 204, Green Valley Apartments, Koramangala, Bengaluru',

    totalAmount: 158,

    items: [

      { id: 'p2', name: 'Pure Cow Milk', price: 68, quantity: 2, unit: '1 Litre', image: 'https://images.unsplash.com/photo-1550583724-1d552049521b' },

      { id: 'p20', name: 'Classic Buttermilk', price: 22, quantity: 1, unit: '250ml', image: 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60' }

    ]

  },

  {

    id: 'ORD004',

    userId: 'user-123',

    status: 'PLACED',

    createdAt: '2026-01-27T08:00:00',

    deliverySlot: '4-7 PM',

    address: 'Office - Tech Park, Whitefield, Bengaluru',

    totalAmount: 725,

    items: [

      { id: 'p12', name: 'Desi Cow Ghee', price: 550, quantity: 1, unit: '500ml', image: 'https://images.unsplash.com/photo-1615485291234-9e7e1f6b7c7c' },

      { id: 'p16', name: 'Cheddar Cheese Block', price: 220, quantity: 1, unit: '200g', image: 'https://images.unsplash.com/photo-1580910051074-7b09c1be4a0c' }

    ]

  },

  {

    id: 'ORD005',

    userId: 'user-123',

    status: 'DELIVERED',

    createdAt: '2026-01-18T09:20:00',

    deliverySlot: '7-10 AM',

    address: 'Flat 204, Green Valley Apartments, Koramangala, Bengaluru',

    totalAmount: 305,

    items: [

      { id: 'p9', name: 'Organic Cow Milk', price: 95, quantity: 2, unit: '1 Litre', image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b' },

      { id: 'p10', name: 'Probiotic Curd', price: 55, quantity: 2, unit: '400g', image: 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60' }

    ]
  },

  
  /* ---------- TEST CASE 1: CANCELABLE (PLACED) ---------- */
  {
    id: 'TEST_CANCEL_01',
    userId: 'user-123',
    status: 'PLACED', // This should show the Cancel Button
    createdAt: new Date().toISOString(), // Today's date
    deliverySlot: '7-10 AM',
    address: 'TEST HOUSE, Sector 5, Bengaluru',
    totalAmount: 170,
    items: [
      { 
        id: 'p1', 
        name: 'Farm Fresh Buffalo Milk', 
        price: 85, 
        quantity: 2, 
        unit: '1 Litre', 
        image: ['https://images.unsplash.com/photo-1563636619-e91000f21fca?q=80&w=800'] 
      }
    ]
  },

  /* ---------- TEST CASE 2: CANCELABLE (CONFIRMED) ---------- */
  {
    id: 'TEST_CANCEL_02',
    userId: 'user-123',
    status: 'CONFIRMED', // This should also show the Cancel Button
    createdAt: new Date().toISOString(),
    deliverySlot: '4-7 PM',
    address: 'TEST OFFICE, Tech Park, Bengaluru',
    totalAmount: 220,
    items: [
      { 
        id: 'p6', 
        name: 'Fresh Malai Paneer', 
        price: 110, 
        quantity: 2, 
        unit: '200g', 
        image: ['https://images.unsplash.com/photo-1631452180519-c014fe946bc7?q=80&w=800'] 
      }
    ]
  },
  /* ---------- TEST CASE 3: POST-DELIVERY (REPORT ISSUE) ---------- */
  {
    id: 'TEST_REPORT_03',
    userId: 'user-123',
    status: 'DELIVERED', // This will now show the Orange "Report Issue" button
    createdAt: new Date().toISOString(),
    deliverySlot: '7-10 AM',
    address: 'TEST HOUSE, Sector 5, Bengaluru',
    totalAmount: 110,
    items: [
      { 
        id: 'p6', 
        name: 'Fresh Malai Paneer', 
        price: 110, 
        quantity: 1, 
        unit: '200g', 
        image: ['https://images.unsplash.com/photo-1631452180519-c014fe946bc7'] 
      }
    ]
  },
  
];

export const PROMO_BANNERS = [
  {
    id: '1',
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1200',
    title: '50% OFF on Fresh Veggies',
  },
  {
    id: '2',
    image: 'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?q=80&w=1200',
    title: 'Fresh Milk Delivered Daily',
  },
];

// Calculation Constants
export const CART_CONFIG = {
  FREE_DELIVERY_THRESHOLD: 500,
  DEFAULT_DELIVERY_FEE: 40,
};

// Utils (Logic kept consistent with your existing code)
export const calculateBillBackend = (items: any[]) => {
  const itemTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryFee = itemTotal >= CART_CONFIG.FREE_DELIVERY_THRESHOLD ? 0 : CART_CONFIG.DEFAULT_DELIVERY_FEE;
  
  return {
    itemTotal,
    deliveryFee,
    grandTotal: itemTotal + deliveryFee,
    isFreeDelivery: deliveryFee === 0,
    amountToFree: Math.max(0, CART_CONFIG.FREE_DELIVERY_THRESHOLD - itemTotal),
    progress: Math.min(1, itemTotal / CART_CONFIG.FREE_DELIVERY_THRESHOLD)
  };
};

export const getCartCalculation = async (items: any[]) => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return calculateBillBackend(items); 
};