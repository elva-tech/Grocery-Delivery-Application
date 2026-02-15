🍎 QuickCommerce Consumer App
Ultra-fast grocery shopping experience with real-time order tracking.

🚀 Overview
Designed for speed and simplicity, the consumer app allows users to browse a dynamic catalog, manage a smart cart, and track their delivery from the moment of placement to the doorstep.

🛠️ How it Works (Current Mock Backend)
The app uses a shared AppStateContext to simulate a backend environment. This allows for a seamless development experience without needing a server running.

State Sharing: The app reads the same product list and stock levels as the Admin dashboard.

Order Lifecycle: When a user clicks "Place Order," a new object is pushed into the global orders array, which immediately triggers a notification on the Admin side.

Live Updates: Order status changes made by the Admin (e.g., "Out for Delivery") reflect instantly in the user's order history page via the Context subscription.

📂 Key Components
ProductCatalog.jsx: Responsive grid with category filtering and real-time stock-check.

CartContext.jsx: Handles local cart persistence, tax calculations, and discount logic.

OrderTracking.jsx: Visual progress bar linked to the status key in the global state.

🚧 Future Backend Integration
To go live, the following changes are required:

API Service Layer: Create a services/api.js file to replace the direct Context mutations with RESTful endpoints.

Payment Gateway: Integrate Razorpay/Stripe within the checkout flow (currently simulated).

GPS Integration: Replace static address labels with Google Maps API for precise rider routing.


Current Data Flow (State-Driven)State Initialization: On mount, AppStateContext checks localStorage. If empty, it hydrates from MOCK_ORDERS.Order Processing: When an action is taken (Accept/Assign), the dispatch or setState function inside the Context updates the global array.Cross-Component Sync: Because OrderList and DashboardHome both consume the same Context, an "Accept" in the list immediately updates the "Pending Status" count in the Home view.💉 Injection Points for API EndpointsWhen you are ready to move to a real backend (Node.js/Express, Python/FastAPI, etc.), follow this map:UI ActionCurrent Function (Context)API Endpoint to CreateAccept OrderupdateOrderStatus(id, 'CONFIRMED')PATCH /api/orders/:id/statusAssign RiderassignRider(orderId, riderName)POST /api/assignmentsAdd PartneraddRider(riderData)POST /api/ridersEdit ProductupdateProduct(id, data)PUT /api/products/:idView Revenueorders.reduce(...)GET /api/analytics/revenue3. Professional Customer App READMELocation: /app/README.md🛒 QuickCommerce Customer AppA high-speed shopping interface with real-time order lifecycle tracking.🧬 Logic & PersistenceSession Management: Uses a specialized CartContext to handle temporary guest carts before order placement.Order Creation: The placeOrder function generates a unique ORD-ID, timestamps it, and pushes it to the shared AppStateContext.Status Listening: The app "listens" to the orders array. When the Admin changes a status key, the OrderTracking component re-renders to show the new stage (e.g., "Out for Delivery").🏗️ Backend Migration StrategyTo transition to a production server, modify your Context files as follows:Step 1: The Fetch WrapperIn AppStateContext.jsx, replace the initial useState with a useEffect hook:JavaScriptuseEffect(() => {
  // Replace localStorage.getItem with this:
  axios.get('/api/products').then(res => setProducts(res.data));
  axios.get('/api/orders').then(res => setOrders(res.data));
}, []);
Step 2: Action RefactoringUpdate your handler functions to be async:JavaScriptconst placeOrder = async (newOrder) => {
  const response = await axios.post('/api/orders', newOrder);
  setOrders([...orders, response.data]); // Update local state with DB response
};
4. The "Why" Behind This ArchitecturePrototyping Speed: You can test the entire user journey (Order -> Accept -> Assign -> Deliver) without writing a single line of SQL or setting up a server.Clean Separation: Your UI components (the "Views") are totally decoupled from the data logic. They only know they need to call updateOrderStatus; they don't care if that function talks to a local array or a server in the cloud.Instant Portability: This entire project can be hosted on Vercel or Netlify as a static site, and it will still "work" for demo purposes.