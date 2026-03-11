import React, { useState } from 'react';
import { useAppState } from '../../context/AppStateContext';
import DataTable from '../../components/shared/DataTable';
import {
  Bike, CheckCircle, PackageCheck, Truck, X, User, CheckCircle2,
  Eye, Phone, Smartphone, Hash, MapPin, MapPinned, ShoppingBag,
  XCircle, AlertTriangle, UserPlus, AlertCircle, Image as ImageIcon, Loader
} from 'lucide-react';

const OrderList = () => {
  const { orders, riders, loading, updateOrderStatus, assignRider } = useAppState();
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [viewingOrder, setViewingOrder] = useState(null);
  const [cancellingOrder, setCancellingOrder] = useState(null);
  const [assigningLoading, setAssigningLoading] = useState(false);

  const availableRiders = riders ? riders.filter(r => r.status === 'Online') : [];

  const handleSelectRider = async (riderId, riderName) => {
    setAssigningLoading(true);
    try {
      // Step 1: Assign the rider to the order
      await assignRider(selectedOrderId, riderId, riderName);
      
      // Step 2: Update order status to OUT_FOR_DELIVERY
      await updateOrderStatus(selectedOrderId, 'OUT_FOR_DELIVERY');
      
    } catch (error) {
      console.error("Failed to assign rider:", error);
      alert('Failed to assign rider. Please try again.');
    } finally {
      // Close modal regardless of success or error
      setSelectedOrderId(null);
      setAssigningLoading(false);
    }
  };

  const confirmCancellation = () => {
    updateOrderStatus(cancellingOrder.id, 'CANCELLED');
    setCancellingOrder(null);
  };

  const columns = [
    { header: 'Order ID', accessor: 'id' },
    { header: 'Customer', render: (_, row) => row.customerName || row.customer || 'Guest User' },
    {
      header: 'Address',
      render: (_, row) => (
        <span className="text-xs truncate max-w-[200px] block">{row.address?.full || 'No Address'}</span>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (v) => {
        const statusKey = v?.toUpperCase() || 'PLACED';
        const colors = {
          'PLACED': 'bg-blue-100 text-blue-700',
          'CONFIRMED': 'bg-amber-100 text-amber-700',
          'OUT_FOR_DELIVERY': 'bg-purple-100 text-purple-700',
          'DELIVERED': 'bg-emerald-100 text-emerald-700',
          'CANCELLED': 'bg-red-100 text-red-700'
        };
        return (
          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${colors[statusKey] || 'bg-gray-100'}`}>
            {statusKey.replace(/_/g, ' ')}
          </span>
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
      <h1 className="text-3xl font-black text-[#1A4D2E]">Order Management</h1>

      {loading ? (
        <div className="flex items-center justify-center h-96">
          <div className="text-center space-y-4">
            <Loader className="w-12 h-12 text-emerald-500 animate-spin mx-auto" />
            <p className="text-slate-600 font-semibold">Loading orders...</p>
          </div>
        </div>
      ) : (
        <>
          <DataTable
        columns={columns}
        data={orders}
        actions={(row) => {
          const status = row.status?.toUpperCase();
          return (
            <div className="flex gap-2">
              <button onClick={() => setViewingOrder(row)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors shadow-sm">
                <Eye size={18} />
              </button>

              {status === 'PLACED' && (
                <>
                  <button onClick={() => updateOrderStatus(row.id, 'CONFIRMED')} className="flex items-center gap-1 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm">
                    <CheckCircle size={14} /> Accept Order
                  </button>
                  <button onClick={() => setCancellingOrder(row)} className="flex items-center gap-1 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 transition-all border border-red-100 shadow-sm">
                    <X size={14} /> Cancel
                  </button>
                </>
              )}

              {status === 'CONFIRMED' && (
                <>
                  <button onClick={() => setSelectedOrderId(row.id)} className="flex items-center gap-1 bg-[#1A4D2E] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:scale-105 transition-all shadow-sm">
                    <UserPlus size={14} /> Assign Rider
                  </button>
                  <button onClick={() => setCancellingOrder(row)} className="flex items-center gap-1 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 transition-all border border-red-100 shadow-sm">
                    <X size={14} /> Cancel
                  </button>
                </>
              )}

              {status === 'OUT_FOR_DELIVERY' && (
                <>
                  <button onClick={() => updateOrderStatus(row.id, 'DELIVERED')} className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-200 transition-all border border-emerald-200 shadow-sm">
                    <CheckCircle2 size={14} /> Mark Delivered
                  </button>
                  <button onClick={() => setCancellingOrder(row)} className="flex items-center gap-1 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 transition-all border border-red-100 shadow-sm">
                    <X size={14} /> Cancel
                  </button>
                </>
              )}
            </div>
          );
        }}
      />

      {/* VIEW DETAILS MODAL */}
      {viewingOrder && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 bg-[#1A4D2E] text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black">Order Summary</h2>
                <p className="text-xs opacity-70 flex items-center gap-1"><Hash size={12} /> {viewingOrder.id}</p>
              </div>
              <button onClick={() => setViewingOrder(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center"><User size={24} /></div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400">Customer Name</p>
                    <p className="font-bold text-slate-800 text-lg">{viewingOrder.customerName || viewingOrder.customer}</p>
                  </div>
                </div>

                <div className="bg-blue-50/50 p-5 rounded-3xl border border-blue-100 space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin size={20} className="text-blue-600 mt-1" />
                    <div className="flex-1">
                      <p className="text-[10px] uppercase font-bold text-gray-400">Delivery Address</p>
                      <p className="font-bold text-slate-700 text-sm leading-snug">{viewingOrder.address?.full}</p>
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

              <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                <div>
                  <p className="text-[10px] uppercase font-bold text-gray-400">Total Bill</p>
                  <p className="font-black text-emerald-600 text-2xl">₹{viewingOrder.totalAmount || viewingOrder.total}</p>
                </div>
              </div>
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
              <button onClick={() => setCancellingOrder(null)} className="py-4 bg-gray-100 text-gray-600 rounded-2xl font-black">NO</button>
              <button onClick={confirmCancellation} className="py-4 bg-red-600 text-white rounded-2xl font-black">YES, CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {/* RIDER SELECTION */}
      {selectedOrderId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-black text-[#1A4D2E]">Assign Partner</h2>
              <button onClick={() => setSelectedOrderId(null)} disabled={assigningLoading} className="text-gray-400 hover:text-gray-600 disabled:opacity-50"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
              {availableRiders.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <p className="font-medium">No available riders</p>
                  <p className="text-xs">Please ensure riders are registered and online</p>
                </div>
              ) : (
                availableRiders.map((rider) => (
                  <div 
                    key={rider.id} 
                    onClick={() => !assigningLoading && handleSelectRider(rider.id, rider.name)} 
                    className={`flex items-center justify-between p-4 rounded-2xl transition-all border border-transparent ${
                      assigningLoading 
                        ? 'cursor-not-allowed opacity-50' 
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
                    {assigningLoading ? (
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
        </>
      )}
    </div>
  );
};

export default OrderList;