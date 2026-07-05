import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Added for navigation
import { Bell, AlertTriangle, Package, X, RotateCcw } from 'lucide-react';
import { useAppState, isPendingReturnRequest } from '../../context/AppStateContext';
import { useTenantBranding } from '../../context/TenantBrandingContext';

const GlobalNotification = () => {
  const { logisticsLabel } = useTenantBranding();
  const { products, orders, returns, appSettings } = useAppState();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const lowStockItems = products.filter(p => p.stock < 10);
  const newOrders = orders.filter((o) => o.status === 'PLACED' || o.orderStatus === 'PLACED');
  const pendingRefunds = appSettings.allowRefunds
    ? returns.filter(isPendingReturnRequest)
    : [];
  const totalCount =
    lowStockItems.length + newOrders.length + pendingRefunds.length;

  // Function to handle clicking an alert
  const handleAlertClick = (path) => {
    navigate(path);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-3 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:bg-gray-50 transition-all group"
      >
        <Bell size={20} className={totalCount > 0 ? "text-emerald-600" : "text-gray-400"} />
        {totalCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white animate-pulse">
            {totalCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-3 w-80 bg-white rounded-[24px] shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
            <div className="p-4 bg-[#1A4D2E] text-white flex justify-between items-center">
              <div>
                <h4 className="font-bold text-sm">Alert Center</h4>
                <p className="text-[10px] opacity-70 italic">Real-time system updates</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded-full"><X size={16}/></button>
            </div>
            
            <div className="max-h-96 overflow-y-auto p-2">
              {totalCount === 0 ? (
                <div className="text-center py-10">
                   <div className="bg-gray-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 text-gray-300">
                      <Bell size={20}/>
                   </div>
                   <p className="text-gray-400 text-xs font-bold uppercase">All caught up!</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {pendingRefunds.map((req) => (
                    <div
                      key={req.id}
                      onClick={() => handleAlertClick('/returns')}
                      className="flex items-center gap-3 p-3 hover:bg-amber-50 rounded-xl cursor-pointer transition-colors"
                    >
                      <div className="w-8 h-8 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center shrink-0">
                        <RotateCcw size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-800">
                          Refund request
                          {req.orderId ? ` · #${String(req.orderId).slice(-6)}` : ''}
                        </p>
                        <p className="text-[10px] text-amber-700 font-bold uppercase">
                          {req.customerName || 'Customer'} — awaiting review
                        </p>
                      </div>
                    </div>
                  ))}

                  {newOrders.map(order => (
                    <div 
                      key={order.id} 
                      onClick={() => handleAlertClick('/orders')}
                      className="flex items-center gap-3 p-3 hover:bg-blue-50 rounded-xl cursor-pointer transition-colors"
                    >
                      <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0"><Package size={16}/></div>
                      <div>
                        <p className="text-xs font-black text-slate-800">New Order {order.id}</p>
                        <p className="text-[10px] text-gray-500">Awaiting acceptance</p>
                      </div>
                    </div>
                  ))}
                  
                  {lowStockItems.map(item => (
                    <div 
                      key={item.id} 
                      onClick={() => handleAlertClick('/products')}
                      className="flex items-center gap-3 p-3 hover:bg-red-50 rounded-xl cursor-pointer transition-colors"
                    >
                      <div className="w-8 h-8 bg-red-100 text-red-600 rounded-lg flex items-center justify-center shrink-0"><AlertTriangle size={16}/></div>
                      <div>
                        <p className="text-xs font-black text-slate-800">{item.name} Low</p>
                        <p className="text-[10px] text-red-500 font-bold uppercase">{item.stock} left</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-3 bg-gray-50 text-center border-t border-gray-100">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                {logisticsLabel}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default GlobalNotification;