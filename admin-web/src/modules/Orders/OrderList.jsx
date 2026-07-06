import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useAppState, normalizeAdminOrderRow } from '../../context/AppStateContext';
import { useToast } from '../../context/ToastContext';
import { useSocket } from '../../hooks/useSocket';
import { apiService } from '../../services/apiService';
import { dashboardService } from '../../services/dashboardApi';
import { playNewOrderSound } from '../../utils/playNotificationSound';
import { formatDate, formatDateTime, formatOrderTime } from '../../utils/helpers';
import DataTable from '../../components/shared/DataTable';
import Pagination from '../../components/shared/Pagination';
import { ORDER_STATUS } from '../../config/constants';
import {
  Bike, CheckCircle, PackageCheck, Truck, X, User, CheckCircle2,
  Eye, Phone, Smartphone, Hash, MapPin, MapPinned, ShoppingBag,
  XCircle, AlertTriangle, UserPlus, AlertCircle, Image as ImageIcon,
  Star, MessageSquare, Filter, Search, Calendar, Banknote, CreditCard,
  ExternalLink, Copy, Loader2, Clock, Zap, Package,
} from 'lucide-react';

/** Renders filled/empty star row */
const StarRating = ({ value }) => (
  <span className="flex gap-0.5">
    {[1,2,3,4,5].map(s => (
      <Star key={s} size={13}
        className={s <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-200 fill-gray-200'}
      />
    ))}
  </span>
);

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All statuses' },
  { value: ORDER_STATUS.PLACED, label: 'Placed' },
  { value: ORDER_STATUS.CONFIRMED, label: 'Confirmed' },
  { value: ORDER_STATUS.OUT_FOR_DELIVERY, label: 'Out for delivery' },
  { value: ORDER_STATUS.DELIVERED, label: 'Delivered' },
  { value: ORDER_STATUS.CANCELLED, label: 'Cancelled' },
];

const renderCustomerPhone = (phone) => {
  const value = String(phone || '').trim();
  if (!value) {
    return <span className="text-[10px] text-gray-400 font-semibold">Not available</span>;
  }
  const tel = value.replace(/\s+/g, '');
  return (
    <a
      href={`tel:${tel}`}
      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-900"
      title={`Call ${value}`}
    >
      <Phone size={13} className="shrink-0" />
      {value}
    </a>
  );
};

/** Returns true when a socket order belongs in the current filtered list. */
function orderMatchesListFilters(order, filters) {
  const status = String(order.status ?? order.orderStatus ?? '').toUpperCase();
  const {
    statusFilter,
    debouncedSearch,
    dateFrom,
    dateTo,
    ratingFilter,
  } = filters;

  if (statusFilter !== 'ALL' && status !== statusFilter) return false;

  const q = debouncedSearch.trim().toLowerCase();
  if (q) {
    const idMatch = String(order.id ?? order._id ?? '').toLowerCase().includes(q);
    const nameMatch = String(order.customerName || order.customer || '')
      .toLowerCase()
      .includes(q);
    if (!idMatch && !nameMatch) return false;
  }

  if (dateFrom || dateTo) {
    const created = new Date(order.date || order.createdAt);
    if (!Number.isNaN(created.getTime())) {
      if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        if (created < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (created > to) return false;
      }
    }
  }

  if (ratingFilter === 'RATED' && !order.rating?.value) return false;
  if (ratingFilter === 'LOW' && (!order.rating?.value || order.rating.value > 2)) {
    return false;
  }

  return true;
}

const getItemsSubtotal = (order) => {
  if (!Array.isArray(order?.items)) return 0;
  return order.items.reduce((sum, item) => {
    const qty = Number(item.quantity ?? item.qty) || 0;
    return sum + (Number(item.price) || 0) * qty;
  }, 0);
};

const STATUS_COLORS = {
  PLACED: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-amber-100 text-amber-700',
  OUT_FOR_DELIVERY: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const ACTIVE_ORDER_STATUSES = new Set([
  ORDER_STATUS.PLACED,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.OUT_FOR_DELIVERY,
]);

const normalizeDeliveryType = (order) => {
  const raw = String(order?.deliveryType || 'STANDARD').toUpperCase();
  return raw === 'EXPRESS' ? 'EXPRESS' : 'STANDARD';
};

const isExpressOrder = (order) => normalizeDeliveryType(order) === 'EXPRESS';

const isActiveExpressOrder = (order) => {
  const status = String(order?.status ?? order?.orderStatus ?? '').toUpperCase();
  return isExpressOrder(order) && ACTIVE_ORDER_STATUSES.has(status);
};

/** Scannable delivery badge — pulses when express order still needs action */
const DeliveryTypeBadge = ({ deliveryType, urgent = false, compact = false }) => {
  const isExpress = deliveryType === 'EXPRESS';
  const sizeClass = compact
    ? 'px-2 py-0.5 text-[9px] gap-1'
    : 'px-2.5 py-1 text-[10px] gap-1.5';

  if (isExpress) {
    return (
      <span
        className={`inline-flex items-center rounded-full font-black uppercase tracking-wide border ${sizeClass} ${
          urgent
            ? 'bg-orange-500 text-white border-orange-600 shadow-md shadow-orange-200/80'
            : 'bg-orange-100 text-orange-800 border-orange-300'
        }`}
        title={urgent ? 'Express — prioritize this order' : 'Express delivery'}
      >
        <Zap size={compact ? 10 : 12} className={`shrink-0 ${urgent ? 'fill-white' : 'fill-orange-500'}`} />
        Express
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full font-bold uppercase tracking-wide border bg-slate-100 text-slate-600 border-slate-200 ${sizeClass}`}
      title="Standard delivery"
    >
      <Package size={compact ? 10 : 12} className="shrink-0" />
      Standard
    </span>
  );
};

const OrderList = () => {
  const { showToast } = useToast();
  const { subscribe, onReconnect, isConnected, connectionError } = useSocket();
  const {
    riders,
    ridersLoading,
    updateOrderStatus,
    assignRider,
    markCODPaid,
    retryOrderRefund,
    refreshOrders,
    refreshRiders,
  } = useAppState();
  const [retryingRefundId, setRetryingRefundId] = useState(null);
  const [selectedOrderForAssign, setSelectedOrderForAssign] = useState(null);
  const [viewingOrder, setViewingOrder] = useState(null);
  const [deliveryAddressModalOrder, setDeliveryAddressModalOrder] = useState(null);
  const [cancellingOrder, setCancellingOrder] = useState(null);
  const [assigningRiderId, setAssigningRiderId] = useState(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [ratingFilter, setRatingFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [orderRows, setOrderRows] = useState([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [highlightedIds, setHighlightedIds] = useState(() => new Set());
  const listRequestRef = useRef(0);
  const highlightTimersRef = useRef(new Map());
  /** Prevents duplicate socket deliveries from incrementing totals twice */
  const processedNewOrderIdsRef = useRef(new Set());

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadOrders = useCallback(async () => {
    const requestId = ++listRequestRef.current;
    setListLoading(true);
    setListError(null);
    try {
      const data = await apiService.getOrders({
        page: currentPage,
        limit: pageSize,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        search: debouncedSearch.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        ratingFilter: ratingFilter !== 'ALL' ? ratingFilter : undefined,
      });
      if (requestId !== listRequestRef.current) return null;

      const normalized = (data.orders || []).map(normalizeAdminOrderRow);
      setOrderRows(normalized);
      setTotalOrders(data.totalOrders ?? 0);
      return normalized;
    } catch (err) {
      if (requestId !== listRequestRef.current) return null;
      console.error('Failed to load orders:', err);
      setListError('Failed to load orders');
      setOrderRows([]);
      setTotalOrders(0);
      return null;
    } finally {
      if (requestId === listRequestRef.current) {
        setListLoading(false);
      }
    }
  }, [currentPage, pageSize, statusFilter, debouncedSearch, dateFrom, dateTo, ratingFilter]);

  const loadPendingCount = useCallback(async () => {
    try {
      const data = await dashboardService.getPendingOrders();
      setPendingCount(data.pendingOrders ?? 0);
    } catch {
      // Non-blocking — counter still updates via socket events
    }
  }, []);

  const highlightOrderRow = useCallback((orderId) => {
    const id = String(orderId);
    setHighlightedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    const existing = highlightTimersRef.current.get(id);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      setHighlightedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      highlightTimersRef.current.delete(id);
    }, 5000);

    highlightTimersRef.current.set(id, timer);
  }, []);

  useEffect(() => {
    loadOrders();
    loadPendingCount();
  }, [loadOrders, loadPendingCount]);

  // Cleanup highlight timers on unmount
  useEffect(() => {
    const timers = highlightTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  // Real-time: new orders and status updates
  useEffect(() => {
    const filterSnapshot = () => ({
      statusFilter,
      debouncedSearch,
      dateFrom,
      dateTo,
      ratingFilter,
    });

    const handleNewOrder = (rawOrder) => {
      const normalized = normalizeAdminOrderRow(rawOrder);
      const orderId = normalized.id;

      // Same event can reach two listeners briefly (re-subscribe on connect) — process once
      if (processedNewOrderIdsRef.current.has(orderId)) return;
      processedNewOrderIdsRef.current.add(orderId);

      showToast('success', 'New Order Received');
      playNewOrderSound();
      highlightOrderRow(orderId);

      if (normalized.status === ORDER_STATUS.PLACED) {
        setPendingCount((count) => count + 1);
      }
      loadPendingCount();

      setTotalOrders((total) => total + 1);

      setOrderRows((prev) => {
        if (prev.some((o) => o.id === orderId)) return prev;
        if (currentPage !== 1) return prev;
        if (!orderMatchesListFilters(normalized, filterSnapshot())) return prev;
        return [normalized, ...prev].slice(0, pageSize);
      });
    };

    const handleOrderUpdated = (rawOrder) => {
      const normalized = normalizeAdminOrderRow(rawOrder);
      const orderId = normalized.id;

      setOrderRows((prev) => {
        const idx = prev.findIndex((o) => o.id === orderId);
        if (idx === -1) return prev;

        const next = [...prev];
        next[idx] = { ...next[idx], ...normalized };
        return next;
      });
      loadPendingCount();

      setViewingOrder((prev) => {
        if (!prev || prev.id !== orderId) return prev;
        return { ...prev, ...normalized };
      });
    };

    const unsubNew = subscribe('new-order', handleNewOrder);
    const unsubUpdated = subscribe('order-updated', handleOrderUpdated);

    return () => {
      unsubNew();
      unsubUpdated();
    };
  }, [
    subscribe,
    showToast,
    highlightOrderRow,
    currentPage,
    pageSize,
    loadPendingCount,
    statusFilter,
    debouncedSearch,
    dateFrom,
    dateTo,
    ratingFilter,
  ]);

  // After reconnect, resync via REST to avoid missing events while offline
  useEffect(() => {
    return onReconnect(() => {
      loadOrders();
      loadPendingCount();
      refreshOrders({ silent: true });
    });
  }, [onReconnect, loadOrders, loadPendingCount, refreshOrders]);

  // Sync once when socket first connects (covers any gap before listeners were live)
  useEffect(() => {
    const onSocketReady = () => {
      loadOrders();
      loadPendingCount();
      refreshOrders({ silent: true });
    };
    window.addEventListener('admin-socket-connected', onSocketReady);
    return () => window.removeEventListener('admin-socket-connected', onSocketReady);
  }, [loadOrders, loadPendingCount, refreshOrders]);

  useEffect(() => {
    if (selectedOrderForAssign) {
      refreshRiders({ silent: true });
    }
  }, [selectedOrderForAssign, refreshRiders]);

  const openAssignModal = async (row) => {
    const orderId = String(row?.id ?? row?._id ?? '').trim();
    if (!orderId) {
      showToast('error', 'Invalid order — refresh the page and try again.');
      return;
    }
    const freshOrders = await loadOrders();
    const fresh = (freshOrders || orderRows).find(
      (o) => String(o.id) === orderId
    );
    const status = String(fresh?.status ?? fresh?.orderStatus ?? '').toUpperCase();
    if (!fresh || status !== 'CONFIRMED') {
      showToast(
        'error',
        status === 'PLACED'
          ? 'Accept the order first, then assign a rider.'
          : `Order is ${status || 'unavailable'} — list refreshed.`,
      );
      return;
    }
    setSelectedOrderForAssign(fresh);
  };

  const hasActiveFilters =
    searchQuery.trim() || dateFrom || dateTo || ratingFilter !== 'ALL' || statusFilter !== 'ALL';

  const clearFilters = () => {
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setRatingFilter('ALL');
    setStatusFilter('ALL');
    setCurrentPage(1);
  };

  const availableRiders = riders
    ? riders.filter((r) => String(r.status || '').toLowerCase() === 'online')
    : [];

  const activeExpressOnPage = useMemo(
    () => orderRows.filter(isActiveExpressOrder).length,
    [orderRows],
  );

  const getOrderRowClassName = useCallback((row) => {
    const classes = [];
    if (highlightedIds.has(String(row.id))) {
      classes.push('bg-emerald-50 ring-2 ring-emerald-300 ring-inset animate-pulse');
    } else if (isActiveExpressOrder(row)) {
      classes.push('bg-orange-50/70 border-l-4 border-l-orange-500');
    } else if (isExpressOrder(row)) {
      classes.push('border-l-4 border-l-orange-200');
    }
    return classes.join(' ');
  }, [highlightedIds]);

  const orderAssignedToRider = (order, riderId, riderName) => {
    if (!order) return false;
    const status = String(order.status ?? order.orderStatus ?? '').toUpperCase();
    if (status !== 'OUT_FOR_DELIVERY') return false;
    const assignedRiderId = order.riderId?._id ?? order.riderId;
    if (assignedRiderId && String(assignedRiderId) === String(riderId)) return true;
    return riderName && order.riderName === riderName;
  };

  const syncOrderPaidInList = (orderId) => {
    const id = String(orderId);
    setOrderRows((prev) =>
      prev.map((o) =>
        String(o.id) === id || String(o._id) === id
          ? { ...o, paymentStatus: 'PAID' }
          : o,
      ),
    );
    setViewingOrder((prev) =>
      prev && (String(prev.id) === id || String(prev._id) === id)
        ? { ...prev, paymentStatus: 'PAID' }
        : prev,
    );
  };

  const handleMarkCODPaid = async (orderId) => {
    const id = String(orderId ?? '').trim();
    if (!id) return;
    try {
      const result = await markCODPaid(id);
      syncOrderPaidInList(id);
      showToast(
        'success',
        result?.alreadyPaid ? 'This order was already marked as paid.' : 'COD order marked as paid.',
      );
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to mark as paid.';
      if (String(msg).toLowerCase().includes('already marked as paid')) {
        syncOrderPaidInList(id);
        showToast('success', msg);
        return;
      }
      showToast('error', msg);
    }
  };

  const verifyOrderAssignment = async (orderId, riderId, riderName) => {
    try {
      const data = await apiService.getOrders({ search: orderId, limit: 5, page: 1 });
      const order = (data.orders || []).map(normalizeAdminOrderRow).find(
        (o) => String(o.id) === String(orderId),
      );
      return orderAssignedToRider(order, riderId, riderName) ? order : null;
    } catch {
      return null;
    }
  };

  const handleSelectRider = async (riderId, riderName) => {
    if (assigningRiderId || !selectedOrderForAssign) return;
    const orderId = String(selectedOrderForAssign.id ?? '').trim();
    setAssigningRiderId(riderId);
    try {
      await assignRider(orderId, riderId, riderName);
      showToast('success', 'Rider assigned — order is now out for delivery.');
      setSelectedOrderForAssign(null);
      await loadOrders();
      refreshOrders({ silent: true });
    } catch (error) {
      console.error('Failed to assign rider:', error);
      const verified = await verifyOrderAssignment(orderId, riderId, riderName);
      if (verified) {
        showToast('success', 'Rider assigned — order is now out for delivery.');
        setSelectedOrderForAssign(null);
        await loadOrders();
        refreshOrders({ silent: true });
        return;
      }
      const apiStatus = error?.response?.data?.currentStatus;
      const msg =
        error?.response?.data?.message ||
        (apiStatus ? `Cannot assign — order is ${apiStatus}` : null) ||
        error?.message ||
        'Failed to assign rider. Please try again.';
      showToast('error', msg);
    } finally {
      setAssigningRiderId(null);
    }
  };

  const confirmCancellation = async () => {
    if (!cancellingOrder || statusUpdatingId) return;
    setStatusUpdatingId(cancellingOrder.id);
    try {
      await updateOrderStatus(cancellingOrder.id, 'CANCELLED');
      await loadOrders();
      await loadPendingCount();
      refreshOrders({ silent: true });
    } finally {
      setStatusUpdatingId(null);
      setCancellingOrder(null);
    }
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    if (statusUpdatingId) return;
    setStatusUpdatingId(orderId);
    try {
      await updateOrderStatus(orderId, newStatus);
      await loadOrders();
      await loadPendingCount();
      refreshOrders({ silent: true });
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const columns = [
    {
      header: 'Order ID',
      render: (_, row) => (
        <div className="flex items-start gap-2 min-w-[88px] max-w-[140px]">
          {isExpressOrder(row) ? (
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-600 ring-1 ring-orange-200"
              title="Express delivery"
            >
              <Zap size={14} className="fill-orange-500 text-orange-500" />
            </span>
          ) : null}
          <span className="font-mono text-[11px] font-bold text-slate-800 break-all leading-snug">
            {row.id}
          </span>
        </div>
      ),
    },
    {
      header: 'Order Date',
      render: (_, row) => {
        const placedAt = row.date || row.createdAt;
        if (!placedAt) {
          return <span className="text-[10px] text-gray-400 font-semibold">—</span>;
        }
        return (
          <div className="min-w-[130px]">
            <p className="text-xs font-bold text-slate-700">{formatDate(placedAt)}</p>
            <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
              <Clock size={10} className="shrink-0" />
              {formatOrderTime(placedAt)}
            </p>
          </div>
        );
      },
    },
    { header: 'Customer', render: (_, row) => row.customerName || row.customer || 'Guest User' },
    {
      header: 'Phone',
      render: (_, row) => renderCustomerPhone(row.customerPhone),
    },
    {
      header: 'Address',
      render: (_, row) => {
        const full = row.address?.full || 'No Address';
        const rawUrl = String(row.address?.addressUrl || '').trim();
        const mapUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : '';
        return (
          <div className="min-w-[220px] max-w-sm space-y-2">
            <p className="text-xs font-medium text-gray-800 whitespace-normal break-words leading-relaxed">
              {full}
            </p>
            {mapUrl ? (
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors w-fit"
              >
                <ExternalLink size={14} className="shrink-0" />
                Open map
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setDeliveryAddressModalOrder(row)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors w-fit"
              >
                <MapPinned size={14} className="shrink-0" />
                View details
              </button>
            )}
          </div>
        );
      },
    },
    {
      header: 'Rating',
      render: (_, row) => {
        if (!row.rating?.value) return <span className="text-[10px] text-gray-400 font-semibold">No rating</span>;
        return (
          <div className="space-y-0.5">
            <StarRating value={row.rating.value} />
            {row.rating.comment && (
              <p className="text-[10px] text-slate-500 italic max-w-[140px] truncate">{row.rating.comment}</p>
            )}
          </div>
        );
      }
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (v) => {
        const statusKey = v?.toUpperCase() || 'PLACED';
        return (
          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${STATUS_COLORS[statusKey] || 'bg-gray-100'}`}>
            {statusKey.replace(/_/g, ' ')}
          </span>
        );
      }
    },
    {
      header: 'Delivery',
      render: (_, row) => (
        <DeliveryTypeBadge
          deliveryType={normalizeDeliveryType(row)}
          urgent={isActiveExpressOrder(row)}
        />
      ),
    },
    {
      header: 'Payment',
      render: (_, row) => {
        const mode = (row.paymentMode || 'ONLINE').toUpperCase();
        const pStatus = (row.paymentStatus || 'PENDING').toUpperCase();
        return (
          <div className="flex flex-col gap-1">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase w-fit ${
              mode === 'COD' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {mode === 'COD' ? <Banknote size={10} /> : <CreditCard size={10} />}
              {mode === 'COD' ? 'COD' : 'Online'}
            </span>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase w-fit ${
              pStatus === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'
            }`}>
              {pStatus}
            </span>
          </div>
        );
      }
    },
    {
      header: 'Assignment',
      accessor: 'assignment',
      render: (val, row) => {
        const status = row.status?.toUpperCase();
        return (
          <div className="flex items-center gap-2">
            {status === 'CONFIRMED' && <Bike size={18} className="text-orange-500 animate-bounce" />}
            {status === 'OUT_FOR_DELIVERY' && <Truck size={18} className="text-purple-600" />}
            {status === 'CANCELLED' && <XCircle size={18} className="text-red-400" />}
            <span className={`font-bold ${status === 'CONFIRMED' ? 'text-orange-600' : 'text-slate-700'}`}>
              {val || 'Unassigned'}
            </span>
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-[#1A4D2E]">Order Management</h1>
            <p className="text-sm text-slate-400 font-medium mt-0.5">
              {totalOrders} order{totalOrders !== 1 ? 's' : ''}
              {hasActiveFilters && <span className="text-emerald-600"> (filtered)</span>}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                  Pending orders
                </span>
                <span className="min-w-[1.5rem] text-center px-2 py-0.5 rounded-lg bg-amber-500 text-white text-xs font-black">
                  {pendingCount}
                </span>
              </div>
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                  isConnected
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
                title={connectionError || (isConnected ? 'Live updates active' : 'Reconnecting…')}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                  }`}
                />
                {isConnected ? 'Live' : 'Offline'}
              </div>
              {activeExpressOnPage > 0 && (
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-500 text-white border border-orange-600 shadow-sm shadow-orange-200"
                  title="Active express orders on this page"
                >
                  <Zap size={12} className="fill-white shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {activeExpressOnPage} express priority
                  </span>
                </div>
              )}
            </div>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-xs font-bold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-xl transition-colors"
            >
              <X size={13} /> Clear Filters
            </button>
          )}
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white border border-slate-100 rounded-[20px] p-4 shadow-sm flex flex-wrap gap-3 items-center">

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by Order ID or Customer name…"
              className="w-full pl-9 pr-9 py-2.5 bg-slate-50 rounded-xl text-sm font-medium placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-emerald-200 transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Date From */}
          <div className="relative">
            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={e => {
                setDateFrom(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-8 pr-3 py-2.5 bg-slate-50 rounded-xl text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-emerald-200 transition-all cursor-pointer"
              title="From date"
            />
          </div>

          <span className="text-slate-300 font-bold text-sm hidden sm:block">→</span>

          {/* Date To */}
          <div className="relative">
            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={e => {
                setDateTo(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-8 pr-3 py-2.5 bg-slate-50 rounded-xl text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-emerald-200 transition-all cursor-pointer"
              title="To date"
            />
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-slate-100 hidden sm:block" />

          {/* Status filter */}
          <div className="flex items-center gap-1.5 min-w-[160px]">
            <Filter size={13} className="text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="flex-1 py-2.5 px-3 bg-slate-50 rounded-xl text-sm font-semibold text-slate-600 outline-none focus:ring-2 focus:ring-emerald-200 cursor-pointer"
            >
              {STATUS_FILTER_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="w-px h-6 bg-slate-100 hidden sm:block" />

          {/* Delivery type legend */}
          <div className="flex items-center gap-2 px-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 hidden lg:inline">
              Delivery
            </span>
            <DeliveryTypeBadge deliveryType="EXPRESS" compact />
            <DeliveryTypeBadge deliveryType="STANDARD" compact />
          </div>

          <div className="w-px h-6 bg-slate-100 hidden sm:block" />

          {/* Rating filter */}
          <div className="flex items-center gap-1.5">
            <Filter size={13} className="text-slate-400" />
            {['ALL','RATED','LOW'].map(f => (
              <button
                key={f}
                onClick={() => {
                  setRatingFilter(f);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 text-[11px] font-black rounded-lg transition-all ${
                  ratingFilter === f
                    ? 'bg-[#1A4D2E] text-white'
                    : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
                }`}
              >
                {f === 'ALL' ? 'All' : f === 'RATED' ? 'Rated' : '⚠ Low (≤2)'}
              </button>
            ))}
          </div>

        </div>
      </div>

    {listLoading && orderRows.length === 0 ? (
      <div className="py-20 flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-100">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading orders…</p>
      </div>
    ) : listError && orderRows.length === 0 ? (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3">
        <AlertCircle className="text-red-600 mt-0.5" size={18} />
        <div className="space-y-3">
          <p className="text-sm font-bold text-red-700">{listError}</p>
          <button
            type="button"
            onClick={() => loadOrders()}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest"
          >
            Retry
          </button>
        </div>
      </div>
    ) : (
      <>
        {listLoading ? (
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-2">
            <Loader2 size={14} className="animate-spin text-emerald-600" />
            Loading orders…
          </div>
        ) : null}

        {activeExpressOnPage > 0 && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 px-4 py-3.5 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white shadow-md shadow-orange-200">
              <Zap size={20} className="fill-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-orange-950">
                {activeExpressOnPage} express order{activeExpressOnPage !== 1 ? 's' : ''} on this page need priority
              </p>
              <p className="text-xs font-semibold text-orange-800/85 mt-0.5 leading-relaxed">
                Orange rows and badges are express delivery — accept and assign riders before standard orders.
              </p>
            </div>
          </div>
        )}

    <DataTable
        columns={columns}
        data={orderRows}
        getRowClassName={getOrderRowClassName}
        actions={(row) => {
          const status = row.status?.toUpperCase();
          return (
            <div className="flex gap-2 items-center flex-wrap">
              <button onClick={() => setViewingOrder(row)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors shadow-sm" title="Order summary">
                <Eye size={18} />
              </button>
              <button
                type="button"
                onClick={() => setDeliveryAddressModalOrder(row)}
                className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#1A4D2E] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                title="Delivery address & map link"
              >
                <MapPinned size={14} />
                View address
              </button>

              {status === 'PLACED' && (
                <>
                  <button
                    disabled={statusUpdatingId === row.id}
                    onClick={() => handleStatusUpdate(row.id, 'CONFIRMED')}
                    className="flex items-center gap-1 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-60"
                  >
                    {statusUpdatingId === row.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                    {statusUpdatingId === row.id ? 'Updating…' : 'Accept Order'}
                  </button>
                  <button onClick={() => setCancellingOrder(row)} className="flex items-center gap-1 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 transition-all border border-red-100 shadow-sm">
                    <X size={14} /> Cancel
                  </button>
                </>
              )}

              {status === 'CONFIRMED' && (
                <>
                  <button onClick={() => openAssignModal(row)} className="flex items-center gap-1 bg-[#1A4D2E] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:scale-105 transition-all shadow-sm">
                    <UserPlus size={14} /> Assign Rider
                  </button>
                  <button onClick={() => setCancellingOrder(row)} className="flex items-center gap-1 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 transition-all border border-red-100 shadow-sm">
                    <X size={14} /> Cancel
                  </button>
                </>
              )}

              {status === 'OUT_FOR_DELIVERY' && (
                <>
                  <button
                    disabled={statusUpdatingId === row.id}
                    onClick={() => handleStatusUpdate(row.id, 'DELIVERED')}
                    className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-200 transition-all border border-emerald-200 shadow-sm disabled:opacity-60"
                  >
                    {statusUpdatingId === row.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    {statusUpdatingId === row.id ? 'Updating…' : 'Mark Delivered'}
                  </button>
                  <button onClick={() => setCancellingOrder(row)} className="flex items-center gap-1 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 transition-all border border-red-100 shadow-sm">
                    <X size={14} /> Cancel
                  </button>
                </>
              )}

              {/* COD: Mark Paid button — show for any COD order still PENDING */}
              {(row.paymentMode === 'COD' || row.paymentMode === 'cod') && (row.paymentStatus || 'PENDING').toUpperCase() === 'PENDING' && status !== 'CANCELLED' && (
                <button
                  onClick={() => handleMarkCODPaid(row.id)}
                  className="flex items-center gap-1 bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-600 transition-all shadow-sm"
                >
                  <Banknote size={14} /> Mark Paid
                </button>
              )}
              {/* Show Paid badge when already paid (active orders only) */}
              {(row.paymentStatus || '').toUpperCase() === 'PAID' && status !== 'CANCELLED' && (
                <div className="flex items-center gap-1 bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase border border-emerald-100">
                   <PackageCheck size={14} /> Paid
                </div>
              )}
              {(row.paymentStatus || '').toUpperCase() === 'REFUNDED' && (
                <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase border border-blue-100">
                  Refunded
                </div>
              )}
              
              {/* Optional: Show Cancelled label in actions to keep row height consistent */}
              {status === 'CANCELLED' && (
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase px-3">Cancelled</span>
                  {(row.paymentMode || '').toUpperCase() === 'ONLINE' && (
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                      (row.paymentStatus || '') === 'REFUNDED' || row.refundStatus === 'FULL'
                        ? 'bg-emerald-50 text-emerald-700'
                        : row.refundStatus === 'FAILED'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {(row.paymentStatus || '') === 'REFUNDED' || row.refundStatus === 'FULL'
                        ? 'Refunded'
                        : row.refundStatus === 'FAILED'
                        ? 'Refund failed'
                        : (row.paymentStatus || '') === 'REFUND_PENDING' || row.refundStatus === 'PENDING'
                        ? 'Refund processing'
                        : row.paymentStatus === 'PAID'
                        ? 'Paid — refund needed'
                        : 'Online'}
                    </span>
                  )}
                  {(row.paymentMode || '').toUpperCase() === 'ONLINE' &&
                    row.refundStatus !== 'FULL' &&
                    (row.paymentStatus || '') !== 'REFUNDED' &&
                    (row.refundStatus === 'FAILED' ||
                      (row.paymentStatus || '') === 'PAID' ||
                      (row.paymentStatus || '') === 'REFUND_PENDING') && (
                    <button
                      type="button"
                      disabled={retryingRefundId === row.id}
                      onClick={async () => {
                        setRetryingRefundId(row.id);
                        try {
                          await retryOrderRefund(row.id);
                        } finally {
                          setRetryingRefundId(null);
                        }
                      }}
                      className="text-[10px] font-bold text-blue-600 hover:underline disabled:opacity-50"
                    >
                      {retryingRefundId === row.id ? 'Refunding…' : 'Retry refund'}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        }}
      />
      <Pagination
        totalItems={totalOrders}
        pageSize={pageSize}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
      />
      </>
    )}

      {/* DELIVERY ADDRESS + MAP LINK */}
      {deliveryAddressModalOrder && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-5 bg-[#1A4D2E] text-white flex justify-between items-start gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-black flex items-center gap-2">
                  <MapPinned size={20} className="shrink-0" />
                  Delivery address
                </h2>
                <p className="text-[11px] opacity-80 mt-1 font-mono truncate">Order {deliveryAddressModalOrder.id}</p>
                {(deliveryAddressModalOrder.date || deliveryAddressModalOrder.createdAt) && (
                  <p className="text-[10px] opacity-70 mt-1 flex items-center gap-1">
                    <Clock size={10} />
                    {formatDateTime(deliveryAddressModalOrder.date || deliveryAddressModalOrder.createdAt)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDeliveryAddressModalOrder(null)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors shrink-0"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <div>
                <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2">Address text</p>
                <p className="text-sm font-semibold text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {deliveryAddressModalOrder.address?.full || 'No address on file'}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2">Map / directions link</p>
                {deliveryAddressModalOrder.address?.addressUrl ? (
                  <div className="space-y-3">
                    <a
                      href={deliveryAddressModalOrder.address.addressUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700 transition-colors"
                    >
                      <ExternalLink size={18} />
                      Open map link
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(deliveryAddressModalOrder.address.addressUrl);
                        showToast('success', 'Copied', 'Map link copied to clipboard');
                      }}
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border-2 border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors"
                    >
                      <Copy size={18} />
                      Copy link
                    </button>
                    <p className="text-[11px] text-slate-500 break-all font-mono bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {deliveryAddressModalOrder.address.addressUrl}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 leading-snug">
                    No link was stored for this order (usually an older order placed before we saved map links). New orders get the map-service link when available, or a directions link built from the delivery coordinates.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW DETAILS MODAL */}
      {viewingOrder && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 bg-[#1A4D2E] text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black">Order Summary</h2>
                <p className="text-xs opacity-70 flex items-center gap-1"><Hash size={12} /> {viewingOrder.id}</p>
                {(viewingOrder.date || viewingOrder.createdAt) && (
                  <p className="text-[11px] opacity-80 flex items-center gap-1.5 mt-1">
                    <Calendar size={11} />
                    Placed on {formatDateTime(viewingOrder.date || viewingOrder.createdAt)}
                  </p>
                )}
              </div>
              <button onClick={() => setViewingOrder(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Order management details */}
              <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-3">
                <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Order Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400">Status</p>
                    <span className={`inline-flex mt-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${STATUS_COLORS[viewingOrder.status?.toUpperCase()] || 'bg-gray-100 text-gray-700'}`}>
                      {(viewingOrder.status || 'PLACED').replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400">Delivery Type</p>
                    <div className="mt-1">
                      <DeliveryTypeBadge
                        deliveryType={normalizeDeliveryType(viewingOrder)}
                        urgent={isActiveExpressOrder(viewingOrder)}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400">Rider</p>
                    <p className="font-bold text-slate-700 text-sm mt-1 flex items-center gap-1">
                      <Bike size={14} className="text-slate-400" />
                      {viewingOrder.assignment || viewingOrder.riderName || 'Unassigned'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400">Last Updated</p>
                    <p className="font-semibold text-slate-600 text-xs mt-1">
                      {viewingOrder.updatedAt ? formatDateTime(viewingOrder.updatedAt) : '—'}
                    </p>
                  </div>
                </div>
                {(viewingOrder.riderAssignedAt || viewingOrder.riderPickupTime || viewingOrder.riderDeliveryTime) && (
                  <div className="pt-3 border-t border-slate-200 space-y-2">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Delivery Timeline</p>
                    {viewingOrder.riderAssignedAt && (
                      <p className="text-xs text-slate-600">
                        <span className="font-bold text-slate-700">Rider assigned:</span>{' '}
                        {formatDateTime(viewingOrder.riderAssignedAt)}
                      </p>
                    )}
                    {viewingOrder.riderPickupTime && (
                      <p className="text-xs text-slate-600">
                        <span className="font-bold text-slate-700">Picked up:</span>{' '}
                        {formatDateTime(viewingOrder.riderPickupTime)}
                      </p>
                    )}
                    {viewingOrder.riderDeliveryTime && (
                      <p className="text-xs text-slate-600">
                        <span className="font-bold text-slate-700">Delivered:</span>{' '}
                        {formatDateTime(viewingOrder.riderDeliveryTime)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center"><User size={24} /></div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400">Customer Name</p>
                    <p className="font-bold text-slate-800 text-lg">{viewingOrder.customerName || viewingOrder.customer}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-50 text-slate-600 rounded-2xl flex items-center justify-center"><Smartphone size={24} /></div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400">Customer Phone</p>
                    <div className="font-bold text-slate-800 text-lg">
                      {renderCustomerPhone(viewingOrder.customerPhone)}
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50/50 p-5 rounded-3xl border border-blue-100 space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin size={20} className="text-blue-600 mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase font-bold text-gray-400">Delivery Address</p>
                      <p className="font-bold text-slate-700 text-sm leading-snug">{viewingOrder.address?.full}</p>
                      <button
                        type="button"
                        onClick={() => setDeliveryAddressModalOrder(viewingOrder)}
                        className="mt-3 flex items-center gap-1.5 text-[10px] font-black uppercase text-[#1A4D2E] bg-white/80 hover:bg-white px-3 py-2 rounded-xl border border-emerald-200 transition-colors"
                      >
                        <MapPinned size={14} />
                        View delivery address
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest flex items-center gap-2"><ShoppingBag size={14} /> Items Ordered</p>
                <div className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-100">
                  {Array.isArray(viewingOrder.items) && viewingOrder.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 border-b border-gray-100 last:border-0">
                      <span className="text-sm font-bold text-slate-700">{item.name} x{item.quantity || item.qty}</span>
                      <span className="text-sm font-black text-slate-800">₹{(item.price || 0) * (item.quantity || item.qty || 0)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-gray-100">
                <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Bill Breakdown</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Items subtotal</span>
                    <span className="font-bold">₹{getItemsSubtotal(viewingOrder)}</span>
                  </div>
                  {Number(viewingOrder.deliveryCharge) > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Delivery charge</span>
                      <span className="font-bold">₹{viewingOrder.deliveryCharge}</span>
                    </div>
                  )}
                  {Number(viewingOrder.discount) > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount</span>
                      <span className="font-bold">−₹{viewingOrder.discount}</span>
                    </div>
                  )}
                  {Number(viewingOrder.couponDiscount) > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Coupon{viewingOrder.couponCode ? ` (${viewingOrder.couponCode})` : ''}</span>
                      <span className="font-bold">−₹{viewingOrder.couponDiscount}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                <div>
                  <p className="text-[10px] uppercase font-bold text-gray-400">Total Bill</p>
                  <p className="font-black text-emerald-600 text-2xl">₹{viewingOrder.totalAmount || viewingOrder.total}</p>
                </div>
                <div className="text-right space-y-1">
                  <div className="flex items-center justify-end gap-1.5">
                    {viewingOrder.paymentMode === 'COD'
                      ? <Banknote size={14} className="text-amber-500" />
                      : <CreditCard size={14} className="text-blue-500" />}
                    <span className={`text-xs font-black uppercase ${viewingOrder.paymentMode === 'COD' ? 'text-amber-600' : 'text-blue-600'}`}>
                      {viewingOrder.paymentMode === 'COD' ? 'Cash on Delivery' : 'Online Payment'}
                    </span>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                    viewingOrder.paymentStatus === 'PAID'
                      ? 'bg-emerald-100 text-emerald-700'
                      : viewingOrder.paymentStatus === 'FAILED'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {viewingOrder.paymentStatus || 'PENDING'}
                  </span>
                </div>
              </div>

              {/* Mark COD as Paid action inside modal */}
              {viewingOrder.paymentMode === 'COD' && viewingOrder.paymentStatus !== 'PAID' && (
                <button
                  disabled={markingPaid}
                  onClick={async () => {
                    setMarkingPaid(true);
                    try {
                      await handleMarkCODPaid(viewingOrder.id);
                    } finally {
                      setMarkingPaid(false);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-black py-3 rounded-2xl transition-all text-sm"
                >
                  {markingPaid ? (
                    <span className="animate-pulse">Updating…</span>
                  ) : (
                    <><Banknote size={16} /> Mark COD as Paid</>
                  )}
                </button>
              )}

              {/* Rating section */}
              {viewingOrder.rating?.value && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Star size={14} className="fill-amber-400 text-amber-400" />
                    <span className="text-[10px] uppercase font-black text-amber-700 tracking-widest">Customer Rating</span>
                  </div>
                  <StarRating value={viewingOrder.rating.value} />
                  {viewingOrder.rating.comment && (
                    <p className="text-sm text-slate-600 italic">"{viewingOrder.rating.comment}"</p>
                  )}
                  {viewingOrder.rating.createdAt && (
                    <p className="text-[10px] text-slate-400">
                      {formatDateTime(viewingOrder.rating.createdAt)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CANCEL POPUP */}
      {cancellingOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-sm p-8 shadow-2xl text-center">
            <AlertTriangle size={40} className="text-red-500 mx-auto mb-6" />
            <h3 className="text-2xl font-black text-slate-800 mb-2">Cancel Order?</h3>
            <div className="grid grid-cols-2 gap-3 mt-8">
              <button onClick={() => setCancellingOrder(null)} disabled={!!statusUpdatingId} className="py-4 bg-gray-100 text-gray-600 rounded-2xl font-black disabled:opacity-50">NO</button>
              <button onClick={confirmCancellation} disabled={!!statusUpdatingId} className="py-4 bg-red-600 text-white rounded-2xl font-black disabled:opacity-50 flex items-center justify-center gap-2">
                {statusUpdatingId ? <><Loader2 size={16} className="animate-spin" /> Cancelling…</> : 'YES, CANCEL'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RIDER SELECTION */}
      {selectedOrderForAssign && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h2 className="font-black text-[#1A4D2E]">Assign Partner</h2>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Order {String(selectedOrderForAssign.id).slice(-8)}
                </p>
              </div>
              <button onClick={() => setSelectedOrderForAssign(null)} disabled={!!assigningRiderId} className="text-gray-400 hover:text-gray-600 disabled:opacity-50"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
              {ridersLoading ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 size={22} className="animate-spin text-emerald-600" />
                  <p className="text-sm font-medium">Loading riders…</p>
                </div>
              ) : availableRiders.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <p className="font-medium">No available riders</p>
                  <p className="text-xs">Please ensure riders are registered and online</p>
                </div>
              ) : (
                availableRiders.map((rider) => (
                  <div 
                    key={rider.id} 
                    onClick={() => !assigningRiderId && handleSelectRider(rider.id, rider.name)} 
                    className={`flex items-center justify-between p-4 rounded-2xl transition-all border border-transparent ${
                      assigningRiderId && assigningRiderId !== rider.id
                        ? 'cursor-not-allowed opacity-50'
                        : assigningRiderId === rider.id
                          ? 'cursor-wait bg-emerald-50/50'
                          : 'hover:bg-emerald-50 cursor-pointer hover:border-emerald-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <User size={20} className="text-gray-400" />
                      <div>
                        <span className="font-bold text-slate-700 block">{rider.name}</span>
                        <span className="text-[10px] font-bold text-gray-400">{rider.phone}</span>
                      </div>
                    </div>
                    {assigningRiderId === rider.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-500 border-t-transparent"></div>
                    ) : (
                      <CheckCircle size={16} className="text-emerald-500" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderList;