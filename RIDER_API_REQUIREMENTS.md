# Rider Management - Missing APIs & Implementation Requirements

## 📋 Current State Analysis

### Frontend Requirements (RiderManagement.jsx)
- ✅ Display riders list with status (Online/Offline)
- ✅ Toggle rider status
- ✅ Add new rider
- ✅ View rider's active tasks (orders with OUT_FOR_DELIVERY status)
- ✅ Assign riders to orders
- ✅ Update order status
- ✅ Prevent rider from going offline when they have active orders

### Backend Status
- ❌ **No Rider model exists**
- ❌ **No Rider controller exists**
- ❌ **No Rider routes exist**
- ⚠️ Order model missing rider assignment field
- ⚠️ User model not extended for rider attributes
- ⚠️ No middleware for role-based rider operations

---

## 🔴 CRITICAL MISSING IMPLEMENTATIONS

### 1. **Database Models** (Backend)

#### A. Rider Model (/backend/src/models/Rider.model.js)
```javascript
Required Fields:
- tenantId: String (required, indexed)
- userId: ObjectId -> ref: "User" (link to user profile)
- name: String (required)
- phoneNumber: String (required, unique per tenant)
- vehicle: Enum ["Bike", "Scooter", "Electric Van"] (required)
- licenseNumber: String (optional)
- licenseExpiry: Date (optional)
- status: Enum ["Online", "Offline", "On Rest", "Inactive"]
- activeOrders: Number (default: 0)
- totalDeliveries: Number (default: 0)
- ratings: Number (default: 0, range: 0-5)
- totalEarnings: Number (default: 0)
- documentsVerified: Boolean (default: false)
- createdAt, updatedAt: Timestamps
- Indexes:
  - { tenantId: 1, phoneNumber: 1 } unique
  - { tenantId: 1, status: 1 }
  - { tenantId: 1, activeOrders: 1 }
```

#### B. Modify Order Model (update orderSchema)
```javascript
Add field:
- riderId: ObjectId -> ref: "Rider" (instead of just assignment string)
- riderAssignedAt: Date
- riderPickupTime: Date
- riderDeliveryTime: Date
- riderName: String (for display purposes)
Add index: { tenantId: 1, riderId: 1, orderStatus: 1 }
```

#### C. Modify User Model (add rider fields)
```javascript
Add fields:
- riderProfile: {
    licenseNumber: String,
    vehicle: String,
    averageRating: Number
  }
```

---

## 🔴 CRITICAL MISSING APIS

### 2. **Rider Routes & Endpoints** (/backend/src/routes/rider.routes.js)

#### GET Endpoints
```
1. GET /api/riders
   - Description: List all riders for the tenant
   - Auth: Admin required
   - Query Params: page, limit, status, search
   - Response: { riders: [], total, page, totalPages }
   
2. GET /api/riders/:id
   - Description: Get single rider details with stats
   - Auth: Admin/Rider (own data only)
   - Response: { rider, activeOrders, totalDeliveries, ratings }
   
3. GET /api/riders/:id/orders
   - Description: Get all orders assigned to a rider
   - Auth: Admin/Rider (own data only)
   - Query Params: status, page, limit
   - Response: { orders: [], total, activeCount }
   
4. GET /api/riders/available
   - Description: Get available riders (Online status, < threshold orders)
   - Auth: Admin
   - Response: { riders: [] }
   
5. GET /api/riders/:id/stats
   - Description: Get rider statistics (earnings, deliveries, ratings)
   - Auth: Admin/Rider
   - Response: { totalDeliveries, totalEarnings, avgRating, onTimeDeliveryRate }
```

#### POST Endpoints
```
1. POST /api/riders (Create/Register new rider)
   - Auth: Admin only
   - Body: {
       userId: ObjectId (or create new user),
       name: String (required),
       phoneNumber: String (required),
       vehicle: String (required),
       licenseNumber: String,
       status: "Offline" (default)
     }
   - Response: { rider, message }
   - Validation: Phone unique per tenant
   
2. POST /api/riders/:id/orders/assign
   - Description: Assign order to rider
   - Auth: Admin only
   - Body: { orderId: String }
   - Response: { updatedOrder, updatedRider }
   - Side Effects:
     * Update order.riderId & order.riderName
     * Increment rider.activeOrders
     * Update order.orderStatus to "OUT_FOR_DELIVERY"
     * Create notification for customer
```

#### PUT Endpoints
```
1. PUT /api/riders/:id/status
   - Description: Toggle rider status Online/Offline/Inactive
   - Auth: Admin/Rider (own only)
   - Body: { status: String }
   - Validation: 
     * Cannot go Offline if activeOrders > 0
     * Cannot go Offline with active deliveries
   - Response: { updatedRider, message }
   
2. PUT /api/riders/:id
   - Description: Update rider details (name, phone, vehicle)
   - Auth: Admin/Rider (own only)
   - Body: { name?, phoneNumber?, vehicle?, licenseNumber? }
   - Response: { updatedRider }
   
3. PUT /api/riders/:id/orders/:orderId/complete
   - Description: Mark delivery complete
   - Auth: Rider only
   - Body: { lat?, lng?, signature?: String }
   - Side Effects:
     * Update order.orderStatus to "DELIVERED"
     * Decrement rider.activeOrders
     * Increment rider.totalDeliveries
     * Update rider.totalEarnings
     * Create notification for customer
   - Response: { updatedOrder, updatedRider }
   
4. PUT /api/riders/:id/orders/:orderId/failed
   - Description: Mark delivery failed
   - Auth: Rider only
   - Body: { reason: String, notes: String }
   - Response: { updatedOrder, updatedRider }
```

#### DELETE Endpoints
```
1. DELETE /api/riders/:id
   - Description: Deactivate/remove rider
   - Auth: Admin only
   - Validation: Cannot delete if activeOrders > 0
   - Response: { message }
```

---

## 🟡 RELATED CHANGES NEEDED

### 3. **Modify Order Controller** (/backend/src/controllers/order.controller.js)

#### Changes to updateOrderStatus()
```javascript
When status = "OUT_FOR_DELIVERY":
  - Validate riderId exists
  - Check if rider is Online
  - Increment rider.activeOrders
  - Update order.riderId & order.riderAssignedAt

When status = "DELIVERED":
  - Decrement rider.activeOrders
  - Increment rider.totalDeliveries
  - Update rider.totalEarnings += order.totalAmount
  - Update order.riderDeliveryTime

When status = "CANCELLED":
  - If OUT_FOR_DELIVERY: decrement rider.activeOrders
  - Restore inventory
```

### 4. **Backend Middleware Updates**

#### New: Rider Authorization Middleware (/backend/src/middleware/rider.middleware.js)
```javascript
- riderOnly: Check if user role is 'RIDER'
- canAccessRider: Check if user is admin OR user is the rider (id match)
- canAssignRider: Check if rider is online and below max orders threshold
```

### 5. **Backend Services** (/backend/src/services/)

#### A. Rider Service (rider.service.js)
```javascript
Exports:
- validateRiderAvailability(riderId)
- assignOrderToRider(orderId, riderId)
- completeDelivery(riderId, orderId, location)
- calculateRiderStats(riderId)
- getRiderEarnings(riderId, dateRange)
```

#### B. Update Order Service (order.service.js)
```javascript
Addition:
- notifyRiderAssignment(riderId, orderId)
- notifyDeliveryCompleted(customerId, orderId, riderId)
```

### 6. **Admin Web Frontend Updates**

#### Update AppStateContext.jsx
```javascript
Add functions:
- addRider(riderData) -> POST /api/riders
- updateRiderStatus(riderId, status) -> PUT /api/riders/:id/status
- getRiders() -> GET /api/riders
- assignOrder(orderId, riderId) -> POST /api/riders/:id/orders/assign
- getRiderOrders(riderId) -> GET /api/riders/:id/orders
- completeDelivery(riderId, orderId) -> PUT /api/riders/:id/orders/:orderId/complete
- getRiderStats(riderId) -> GET /api/riders/:id/stats
```

---

## 📋 IMPLEMENTATION PRIORITY

### Phase 1: Core Infrastructure (Critical)
1. ✅ Create Rider Model
2. ✅ Update Order Model with riderId field
3. ✅ Create Rider Controller with full CRUD
4. ✅ Create Rider Routes
5. ✅ Create Rider middleware

### Phase 2: Order-Rider Integration (High)
6. ✅ Implement assignOrderToRider API
7. ✅ Update updateOrderStatus to handle rider logic
8. ✅ Implement completeDelivery API
9. ✅ Add rider notifications

### Phase 3: Frontend Integration (Medium)
10. ✅ Connect AppStateContext to real APIs
11. ✅ Update RiderManagement component to use APIs
12. ✅ Add error handling & loading states
13. ✅ Add real-time rider status synchronization

### Phase 4: Advanced Features (Nice to Have)
14. ✅ Rider earnings tracking
15. ✅ Rider ratings & reviews
16. ✅ Geolocation tracking
17. ✅ Delivery analytics

---

## 🔧 Database Queries Needed

```javascript
// Find available riders for order assignment
db.riders.find({
  tenantId: "...",
  status: "Online",
  activeOrders: { $lt: MAX_ORDERS_PER_RIDER }
})

// Get rider's current active orders
db.orders.find({
  tenantId: "...",
  riderId: ObjectId("..."),
  orderStatus: "OUT_FOR_DELIVERY"
})

// Rider daily earnings
db.orders.aggregate([
  {
    $match: {
      tenantId: "...",
      riderId: ObjectId("..."),
      orderStatus: "DELIVERED",
      riderDeliveryTime: { $gte: new Date(today) }
    }
  },
  { $group: { _id: null, total: { $sum: "$totalAmount" } } }
])
```

---

## 📊 Data Flow Diagram

```
1. Admin assigns order to rider:
   AdminWeb -> POST /api/orders/:orderId/assign-rider { riderId }
   -> Backend validates rider availability
   -> Updates Order: { riderId, riderName, status: OUT_FOR_DELIVERY }
   -> Updates Rider: { activeOrders++, orderAssignedAt }
   -> Notifies rider & customer
   
2. Rider completes delivery:
   Rider App -> PUT /api/riders/:id/orders/:orderId/complete
   -> Backend validates rider & order
   -> Updates Order: { status: DELIVERED, riderDeliveryTime }
   -> Updates Rider: { activeOrders--, totalDeliveries++, totalEarnings+= }
   -> Creates notification for customer
   
3. Admin views rider status:
   AdminWeb -> GET /api/riders/:id/orders
   -> Backend returns { rider, activeOrders[], stats }
   -> Display in RiderManagement component
```

---

## ⚠️ Important Validation Rules

```
1. Rider Status Transitions:
   Online -> Offline (only if activeOrders === 0)
   Online -> Inactive
   Offline -> Online
   Inactive -> Offline

2. Order Assignment Rules:
   - Only assign to Online riders
   - Only assign to riders with activeOrders < MAX_ORDERS
   - Can only assign from CONFIRMED status
   - Auto-transition to OUT_FOR_DELIVERY on assignment

3. Delivery Completion Rules:
   - Only rider assigned to order can complete it
   - Can only complete OUT_FOR_DELIVERY orders
   - Must provide location coordinates
   - Notify customer on completion

4. Rider Offline Rules:
   - Cannot go offline with any active orders
   - Cannot go offline with orders in OUT_FOR_DELIVERY state
   - Admin can force offline if necessary (with validation)
```

---

## 🎯 Testing Checklist

- [ ] Create rider with all required fields
- [ ] List riders with filters (status, search)
- [ ] Assign order to online rider
- [ ] Prevent offline rider assignment
- [ ] Prevent rider offline when orders active
- [ ] Complete delivery & update stats
- [ ] Verify order-rider relationship consistency
- [ ] Test concurrent order assignments
- [ ] Verify notifications trigger correctly
- [ ] Test rider earnings calculations