# Enandi Admin Console

**v1.0 – The Intelligent Inventory & Order Fulfillment Engine**

## 🎯 Overview

Enandi Admin is a specialized ERP interface built to manage **high‑volume SKUs** across multiple business verticals. Unlike generic CRUD-based admin panels, Enandi Admin is designed around a **Parent–Child Pillar Architecture**, ensuring:

* High data integrity
* Fast navigation even with thousands of products
* Clean, scalable UI patterns

---

## 🏛 System Architecture: The Pillar Model

To keep the interface performant and readable at scale, Enandi Admin uses a **three-tier hierarchical structure**.

### Tier 1: Pillars (Top-Level Categories)

**Purpose**: Represents core business units (e.g., Dairy, Dry Fruits)

* `parentId: null`
* Acts as the primary navigation switch
* Rendered as **large 40px circular icons** for quick access

---

### Tier 2: Sub-Categories

**Purpose**: Defines specific product niches under each Pillar (e.g., Buffalo Milk, Cashews)

* Linked to Pillars using `parentId`
* Dynamically filtered based on the active Pillar
* Prevents UI clutter when managing large inventories

---

### Tier 3: Products (SKUs)

**Purpose**: Represents individual sellable items

* Includes price, stock, unit, and asset data
* Dual-linked to **both Pillar and Sub-Category**
* Prevents *orphaned data* during filtering or navigation

---

## 🧠 State Management

### `AppStateContext.js`

The application uses a **Local‑First State Engine** built with React Context.

#### Key Characteristics

* Centralized global store
* Predictable mutations for Add / Edit / Delete
* Optimized for admin-side workflows

### ⚡ Real-Time Persistence

* Automatic sync with `sessionStorage`
* Every state mutation is mirrored using `useEffect`
* Ensures data survival across refreshes during admin sessions

---

## 🛠 Order Management Logic

### Order Normalization

* Complex address objects are flattened into a **Full Address string** for admin readability
* Raw address fields are preserved for rider dispatch systems

### 🚴 Rider Workload Sync

Automated workload tracking ensures accurate delivery assignment:

* **Assign Order** → increments `activeOrders`
* **Deliver / Cancel Order** → decrements `activeOrders`

---

## 🛠 Technical Implementation Details

| Feature         | Implementation                                                                 |
| --------------- | ------------------------------------------------------------------------------ |
| ID Engine       | Auto-slugging converts names into `cat_name_format` for predictable APIs       |
| Data Validation | Hard constraints using `Math.abs()` and `Math.max(0)` to block negative values |
| Asset Handling  | Array-based `image[]` support (first image for icons, full set for galleries)  |
| Performance     | Memoized filtering via `useMemo` (Search + Pillar + Sub-Category)              |

---

## 🎨 UI & UX Standards

### Brand Identity

* Primary color: **#1A4D2E (Forest Green)**
* Used for high-trust and primary action buttons

### Inventory Safety Guards

* Items with stock `< 10` trigger **High‑Priority Red Alerts** in inventory tables

### Contextual & Intelligent Forms

* **Dependent Select Logic**
* Sub-category options reload instantly when the Pillar changes
* Prevents invalid SKU categorization

---


## ✅ Design Philosophy

Enandi Admin is built for **speed, scale, and safety** — prioritizing admin efficiency, predictable data relationships, and a UI that stays clean even as the business grows.
