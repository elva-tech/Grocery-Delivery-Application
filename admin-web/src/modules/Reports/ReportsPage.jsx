import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { normalizeAdminOrderRow } from '../../context/AppStateContext';
import DataTable from '../../components/shared/DataTable';
import { apiService } from '../../services/apiService';
import CustomButton from '../../components/shared/CustomButton';
import { Search, Download, Loader2, AlertCircle } from 'lucide-react';
import Pagination from '../../components/shared/Pagination';
import { useTenantBranding } from '../../context/TenantBrandingContext';

const ReportsPage = () => {
  const { storeName } = useTenantBranding();

  const [activeTab, setActiveTab] = useState('REVENUE');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [revenueReport, setRevenueReport] = useState({ totalRevenue: 0, rows: [], totalItems: 0 });
  const [orderRows, setOrderRows] = useState([]);
  const [orderTotal, setOrderTotal] = useState(0);
  const [inventory, setInventory] = useState([]);
  const [inventoryTotal, setInventoryTotal] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const searchParam = debouncedSearch.trim() || undefined;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    apiService
      .getRevenueReport({ page: 1, limit: 1 })
      .then((res) => {
        if (res?.success) {
          setRevenueReport((prev) => ({
            ...prev,
            totalRevenue: res.totalRevenue ?? 0,
          }));
        }
      })
      .catch(() => {});
  }, []);

  const loadTabData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'REVENUE') {
        const res = await apiService.getRevenueReport({
          page: currentPage,
          limit: pageSize,
          search: searchParam,
        });
        if (res.success) {
          setRevenueReport({
            totalRevenue: res.totalRevenue ?? 0,
            rows: res.rows || [],
            totalItems: res.orderCount ?? 0,
          });
        } else {
          setRevenueReport({ totalRevenue: 0, rows: [], totalItems: 0 });
          setError('Failed to load revenue report');
        }
      } else if (activeTab === 'ORDERS') {
        const res = await apiService.getOrders({
          page: currentPage,
          limit: pageSize,
          search: searchParam,
        });
        const normalized = (res.orders || []).map(normalizeAdminOrderRow);
        setOrderRows(normalized);
        setOrderTotal(res.totalOrders ?? 0);
      } else if (activeTab === 'INVENTORY') {
        const res = await apiService.getInventory({
          page: currentPage,
          limit: pageSize,
          search: searchParam,
        });
        if (res.success) {
          setInventory(res.data || []);
          setInventoryTotal(res.totalItems ?? res.data?.length ?? 0);
        } else {
          setInventory([]);
          setInventoryTotal(0);
          setError('Failed to load inventory report');
        }
      }
    } catch (err) {
      console.error('Report load error:', err);
      setError('Failed to load report data');
      if (activeTab === 'REVENUE') {
        setRevenueReport({ totalRevenue: 0, rows: [], totalItems: 0 });
      } else if (activeTab === 'ORDERS') {
        setOrderRows([]);
        setOrderTotal(0);
      } else {
        setInventory([]);
        setInventoryTotal(0);
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, currentPage, pageSize, searchParam]);

  useEffect(() => {
    loadTabData();
  }, [loadTabData]);

  const totalRevenue = revenueReport.totalRevenue ?? 0;

  const revenueData = useMemo(() => {
    return (revenueReport.rows || []).map((row) => {
      const status = String(row.orderStatus || '').toUpperCase();
      const net = Number(row.amount) || 0;
      const gross = Number(row.grossAmount) || 0;
      return {
        date: row.date
          ? new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
          : 'N/A',
        dateRaw: row.date,
        customer: row.customer || 'Unknown',
        amount: `₹${net.toLocaleString('en-IN')}`,
        netAmount: net,
        grossAmount: gross,
        status:
          status === 'REFUND_APPROVED' || row.paymentStatus === 'REFUNDED'
            ? `REFUNDED (₹${(Number(row.refundAmount) || gross).toLocaleString('en-IN')})`
            : status,
      };
    });
  }, [revenueReport.rows]);

  const inventoryReport = useMemo(() => {
    return (inventory || []).map((p) => ({
      item: p.name,
      stock: p.availableQty,
      price: `₹${p.price}`,
      status: p.availableQty < p.thresholdQty ? 'RESTOCK SOON' : 'HEALTHY',
    }));
  }, [inventory]);

  const tableData =
    activeTab === 'REVENUE'
      ? revenueData
      : activeTab === 'ORDERS'
        ? orderRows
        : inventoryReport;

  const totalItems =
    activeTab === 'REVENUE'
      ? revenueReport.totalItems
      : activeTab === 'ORDERS'
        ? orderTotal
        : inventoryTotal;

  const formatExportDate = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return 'N/A';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const escapeCsv = (value) => {
    const s = String(value ?? '');
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  /** Excel formula string — stops auto date parse and ######## in narrow columns. */
  const csvDate = (date) => {
    const formatted = formatExportDate(date);
    if (formatted === 'N/A') return escapeCsv('N/A');
    return `"=""${formatted}"""`;
  };

  const exportToCSV = async () => {
    setExporting(true);
    try {
      let headers = '';
      let rows = '';

      if (activeTab === 'REVENUE') {
        const allRows = await apiService.getAllRevenueRows({ search: searchParam });
        headers = 'Date,Customer,Net Revenue,Gross,Status\n';
        rows = allRows
          .map((row) => {
            const status = String(row.orderStatus || '').toUpperCase();
            const displayStatus =
              status === 'REFUND_APPROVED' || row.paymentStatus === 'REFUNDED'
                ? `REFUNDED`
                : status;
            return `${csvDate(row.date)},${escapeCsv(row.customer)},${row.amount},${row.grossAmount},${displayStatus}`;
          })
          .join('\n');
      } else if (activeTab === 'ORDERS') {
        const allOrders = await apiService.getAllOrders({ search: searchParam });
        const normalized = allOrders.map(normalizeAdminOrderRow);
        headers = 'Order ID,Customer,Customer Location,Order Details,Total Amount,Status,Date\n';
        rows = normalized
          .map((o) => {
            const displayStatus =
              o.status?.toUpperCase() === 'DELIVERED' ? 'PAID' : o.status;
            return [
              escapeCsv(o.id),
              escapeCsv(o.customerName || 'N/A'),
              escapeCsv(o.address?.full || 'N/A'),
              escapeCsv(o.itemsText || 'N/A'),
              escapeCsv(o.totalAmount || 0),
              escapeCsv(displayStatus),
              csvDate(o.date || o.createdAt),
            ].join(',');
          })
          .join('\n');
      } else {
        const allInventory = await apiService.getAllInventory({ search: searchParam });
        const mapped = (allInventory || []).map((p) => ({
          item: p.name,
          stock: p.availableQty,
          price: p.price,
          status: p.availableQty < p.thresholdQty ? 'RESTOCK SOON' : 'HEALTHY',
        }));
        headers = 'Item Name,Current Stock,Price,Status\n';
        rows = mapped
          .map((i) => `${i.item},${i.stock},${i.price},${i.status}`)
          .join('\n');
      }

      const BOM = '\uFEFF';
      const blob = new Blob([BOM + headers + rows], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const slug =
        storeName.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/gi, '') || 'Store';
      a.download = `${slug}_${activeTab}_Report.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const reportConfigs = {
    REVENUE: {
      title: 'Earnings Report',
      columns: [
        { header: 'Date', accessor: 'date' },
        { header: 'Customer', accessor: 'customer' },
        { header: 'Net revenue', accessor: 'amount' },
        {
          header: 'Status',
          accessor: 'status',
          render: (v) => {
            const s = String(v || '');
            const isRefund = s.includes('REFUND');
            return (
              <span
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                  isRefund ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {s || 'DELIVERED'}
              </span>
            );
          },
        },
      ],
    },
    ORDERS: {
      title: 'Order History',
      columns: [
        { header: 'Order ID', accessor: 'id' },
        {
          header: 'Date',
          accessor: 'date',
          render: (_, row) => (
            <span className="text-xs text-slate-600 whitespace-nowrap">
              {formatExportDate(row.date || row.createdAt)}
            </span>
          ),
        },
        {
          header: 'Customer',
          accessor: 'customerName',
          render: (_, row) => row.customerName || row.customer || 'Unknown',
        },
        {
          header: 'Customer Location',
          accessor: 'address',
          render: (_, row) => (
            <span className="text-xs text-slate-600 whitespace-normal break-words max-w-xs block">
              {row.address?.full || 'N/A'}
            </span>
          ),
        },
        {
          header: 'Order Details',
          accessor: 'itemsText',
          render: (v) => (
            <span className="text-xs text-slate-600 whitespace-normal break-words max-w-sm block">
              {v || 'N/A'}
            </span>
          ),
        },
        {
          header: 'Status',
          accessor: 'status',
          render: (v) => (
            <span
              className={`font-bold ${
                v?.toUpperCase() === 'CANCELLED' ? 'text-red-500' : 'text-slate-600'
              }`}
            >
              {v}
            </span>
          ),
        },
        {
          header: 'Total',
          accessor: 'totalAmount',
          render: (v) => `₹${(Number(v) || 0).toLocaleString('en-IN')}`,
        },
      ],
    },
    INVENTORY: {
      title: 'Stock Audit',
      columns: [
        { header: 'Item Name', accessor: 'item' },
        { header: 'Current Stock', accessor: 'stock' },
        {
          header: 'Status',
          accessor: 'status',
          render: (v) => (
            <span
              className={`px-3 py-1 rounded-lg text-[10px] font-bold ${
                v === 'HEALTHY' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'
              }`}
            >
              {v}
            </span>
          ),
        },
      ],
    },
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="bg-[#1A4D2E] text-white p-8 rounded-[32px] shadow-lg flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black">
            Total Revenue: ₹{totalRevenue.toLocaleString('en-IN')}
          </h1>
          <p className="text-green-200/60 text-sm mt-1">
            Delivered orders only; refunds reduce net revenue.
          </p>
        </div>
        <CustomButton
          onClick={exportToCSV}
          disabled={exporting}
          className="bg-white text-[#1A4D2E] px-8 py-4 rounded-2xl font-black flex gap-2 shadow-xl disabled:opacity-60"
        >
          {exporting ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
          {exporting ? 'EXPORTING…' : 'EXPORT'}
        </CustomButton>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          {['REVENUE', 'ORDERS', 'INVENTORY'].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setCurrentPage(1);
                setSearchTerm('');
              }}
              className={`px-6 py-3 rounded-xl font-bold transition-all ${
                activeTab === tab ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-500'
              }`}
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
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">
              Loading {activeTab.toLowerCase()} report...
            </p>
          </div>
        ) : error ? (
          <div className="py-8 flex items-start gap-3 bg-red-50 border border-red-100 rounded-2xl p-4">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
            <div className="space-y-3">
              <p className="text-sm font-bold text-red-700">{error}</p>
              <button
                onClick={loadTabData}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <>
            <DataTable columns={reportConfigs[activeTab].columns} data={tableData} />
            <Pagination
              totalItems={totalItems}
              pageSize={pageSize}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
