import React, { useState, useMemo, useEffect } from 'react';
import { useAppState } from '../../context/AppStateContext';
import DataTable from '../../components/shared/DataTable';
import { apiService } from '../../services/apiService';
import CustomButton from '../../components/shared/CustomButton';
import { TrendingUp, ShoppingBag, FileText, Search, X, Download } from 'lucide-react';
import Pagination from '../../components/shared/Pagination';
import usePagination from '../../hooks/usePagination';

const ReportsPage = () => {
  const { orders } = useAppState();

  const [activeTab, setActiveTab] = useState('REVENUE');
  const [searchTerm, setSearchTerm] = useState('');

const [inventory, setInventory] = useState([]);
const [loading, setLoading] = useState(false);

useEffect(() => {
  const fetchInventory = async () => {
    try {
      setLoading(true);

      const res = await apiService.getInventory();

      console.log("Inventory API:", res);

      if (res.success) {
        setInventory(res.data);
      } else {
        setInventory([]);
      }

    } catch (err) {
      console.error("Inventory error:", err);
      setInventory([]);
    } finally {
      setLoading(false);
    }
  };

  fetchInventory();
}, []);

  // 1. TOTAL REVENUE - count DELIVERED or PAID orders, exclude CANCELLED
  const totalRevenue = useMemo(() => {
    return (orders || [])
      .filter(o => {
        const status = o.status?.toUpperCase();
        const paymentStatus = o.paymentStatus?.toUpperCase();
        return status !== 'CANCELLED' && (paymentStatus === 'PAID' || status === 'DELIVERED');
      })
      .reduce((sum, order) => sum + (Number(order.totalAmount || order.total) || 0), 0);
  }, [orders]);

  // 2. CSV EXPORT - FIXED: Updated keys
  const exportToCSV = () => {
    let headers = "";
    let rows = "";

    // Helper to format date safely for Excel (YYYY-MM-DD)
    const formatDate = (date) => {
      if (!date) return 'N/A';
      const d = new Date(date);
      return isNaN(d.getTime()) ? 'N/A' : d.toISOString().split('T')[0];
    };

    if (activeTab === 'REVENUE') {
      headers = "Date,Customer,Amount,Status\n";
      rows = revenueData.map(o => {
        const dateRaw = orders.find(orig => orig.customerName === o.customer || orig.customer === o.customer)?.date;
        return `${formatDate(dateRaw)},${o.customer},${o.amount.replace(/[₹,]/g, '')},${o.status || 'PAID'}`;
      }).join("\n");
    } else if (activeTab === 'ORDERS') {
      headers = "Order ID,Customer,Total Amount,Status,Date\n";
      rows = orders.map(o => {
        // LOGIC: Map 'DELIVERED' to 'PAID' for the report output
        const displayStatus = o.status?.toUpperCase() === 'DELIVERED' ? 'PAID' : o.status;
        return `${o.id},${o.customerName || 'N/A'},${o.totalAmount || 0},${displayStatus},${formatDate(o.date)}`;
      }).join("\n");
    } else if (activeTab === 'INVENTORY') {
      headers = "Item Name,Current Stock,Price,Status\n";
      rows = inventoryReport.map(i => `${i.item},${i.stock},${i.price.replace(/[₹,]/g, '')},${i.status}`).join("\n");
    }

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FreshRoot_${activeTab}_Report.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // 3. REVENUE DATA - FIXED: Using totalAmount and customerName
const revenueData = useMemo(() => {
    return (orders || [])
      .filter(o => o.status?.toUpperCase() !== 'CANCELLED')
      .map(o => {
        const status = o.status?.toUpperCase();
        return {
          date: o.date ? new Date(o.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'N/A',
          customer: o.customerName || o.customer || 'Unknown',
          amount: `₹${(Number(o.totalAmount || o.total) || 0).toLocaleString('en-IN')}`,
          // If status is DELIVERED, display as PAID
          status: status === 'DELIVERED' ? 'PAID' : status 
        };
      });
  }, [orders]);

 const inventoryReport = useMemo(() => {
  return (inventory || []).map(p => ({
    item: p.name,
    stock: p.availableQty,
    price: `₹${p.price}`,
    status: p.availableQty < p.thresholdQty ? "RESTOCK SOON" : "HEALTHY"
  }));
}, [inventory]);

const getFilteredData = () => {
  const currentData =
    activeTab === 'REVENUE'
      ? revenueData
      : activeTab === 'ORDERS'
      ? orders
      : inventoryReport;

  if (!searchTerm) return currentData;

  return currentData.filter(item =>
    (item.customer ||
      item.customerName ||
      item.item ||
      item.id ||
      '')
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );
};

const filteredData = useMemo(() => getFilteredData(), [activeTab, searchTerm, orders, inventory]);

const {
  currentPage,
  pageSize,
  setCurrentPage,
  setPageSize,
  paginatedItems
} = usePagination(filteredData);

  const reportConfigs = {
    REVENUE: { title: 'Earnings Report', columns: [
      { header: 'Date', accessor: 'date' },
      { header: 'Customer', accessor: 'customer' },
      { header: 'Revenue', accessor: 'amount' },
      { header: 'Status', accessor: 'status', render: (v) => (
        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">
          {v || 'PAID'}
        </span>
      )}
    ]},
   ORDERS: { 
  title: 'Order History', 
  columns: [
    { header: 'Order ID', accessor: 'id' },

    { 
      header: 'Customer',
      accessor: 'customerName',
      render: (_, row) => row.customerName || row.customer || 'Unknown'
    },

    { 
      header: 'Status', 
      accessor: 'status', 
      render: (v) => (
        <span className={`font-bold ${v?.toUpperCase() === 'CANCELLED' ? 'text-red-500' : 'text-slate-600'}`}>
          {v}
        </span>
      )
    },

    { 
      header: 'Total', 
      accessor: 'totalAmount', 
      render: (v) => `₹${(Number(v) || 0).toLocaleString('en-IN')}`
    }
  ]
},
    INVENTORY: { title: 'Stock Audit', columns: [
      { header: 'Item Name', accessor: 'item' },
      { header: 'Current Stock', accessor: 'stock' },
      { header: 'Status', accessor: 'status', render: (v) => (
        <span className={`px-3 py-1 rounded-lg text-[10px] font-bold ${v === 'HEALTHY' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
          {v}
        </span>
      )}
    ]}
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="bg-[#1A4D2E] text-white p-8 rounded-[32px] shadow-lg flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black">Total Revenue: ₹{totalRevenue.toLocaleString('en-IN')}</h1>
          <p className="text-green-200/60 text-sm mt-1">Confirmed earnings excluding cancelled orders.</p>
        </div>
        <CustomButton onClick={exportToCSV} className="bg-white text-[#1A4D2E] px-8 py-4 rounded-2xl font-black flex gap-2 shadow-xl">
          <Download size={20} /> EXPORT
        </CustomButton>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          {['REVENUE', 'ORDERS', 'INVENTORY'].map(tab => (
            <button 
              key={tab}
              onClick={() => {
  setActiveTab(tab);
  setCurrentPage(1);
}}
              className={`px-6 py-3 rounded-xl font-bold transition-all ${activeTab === tab ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-500'}`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Search..." 
            value={searchTerm}
            onChange={(e) => {
  setSearchTerm(e.target.value);
  setCurrentPage(1);
}}
            className="pl-10 pr-4 py-2 border rounded-xl outline-none w-64"
          />
        </div>
      </div>

      <div className="bg-white p-8 rounded-[32px] border shadow-sm">
        <DataTable 
  columns={reportConfigs[activeTab].columns} 
  data={paginatedItems} 
/>
<Pagination
  totalItems={filteredData.length}
  pageSize={pageSize}
  currentPage={currentPage}
  onPageChange={setCurrentPage}
  onPageSizeChange={setPageSize}
/>
      </div>
    </div>
  );
};

export default ReportsPage;