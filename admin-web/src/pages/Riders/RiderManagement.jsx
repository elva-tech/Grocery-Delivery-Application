import React, { useState, useEffect } from 'react';
import { useAppState } from '../../context/AppStateContext';
import { apiService } from '../../services/apiService';
import { Bike, UserPlus, Search, Phone, Truck, Zap, X, AlertTriangle, Package, ExternalLink, Loader2 } from 'lucide-react';

const RiderManagement = () => {
  const { riders, orders, toggleRiderStatus, addRider } = useAppState();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showWarning, setShowWarning] = useState(null); 
  const [viewTasks, setViewTasks] = useState(null); 
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [newRider, setNewRider] = useState({ name: '', phone: '', vehicle: 'Bike' });
  const [localRiders, setLocalRiders] = useState(riders);

  // Refetch riders when component mounts to get latest data
  const refetchRiders = async () => {
    try {
      setInitialLoading(true);
      setLoadError('');
      const data = await apiService.getRiders();
      const normalized = (data.data?.riders || []).map(r => ({
        ...r,
        id: r._id,
      }));
      setLocalRiders(normalized);
    } catch (error) {
      console.error("Failed to refetch riders:", error);
      setLoadError('Failed to load delivery partners');
      setLocalRiders([]);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    refetchRiders();
  }, []);

  // Update local riders when context riders change
  useEffect(() => {
    setLocalRiders(riders);
  }, [riders]);

  const filteredRiders = localRiders.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleToggleClick = async (rider) => {
    if (rider.status === 'Online' && rider.activeOrders > 0) {
      setShowWarning(rider);
    } else {
      setIsLoading(true);
      try {
        const newStatus = rider.status === 'Online' ? 'Offline' : 'Online';
        await toggleRiderStatus(rider.id || rider._id, newStatus);
      } catch (error) {
        console.error("Failed to toggle rider status:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // FIXED: Removed the "Rider - " prefix to match how orders are actually assigned
  const getRiderOrders = (riderName) => {
    return orders.filter(o => 
      o.assignment === riderName && 
      o.status?.toUpperCase() === 'OUT_FOR_DELIVERY'
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newRider.name || !newRider.phone) return;
    
    setIsLoading(true);
    try {
      await addRider(newRider);
      
      // Refetch local riders to show the newly added rider
      const data = await apiService.getRiders();
      const normalized = (data.data?.riders || []).map(r => ({
        ...r,
        id: r._id,
      }));
      setLocalRiders(normalized);
      
      setShowModal(false);
      setNewRider({ name: '', phone: '', vehicle: 'Bike' });
    } catch (error) {
      console.error("Failed to add rider:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#1A4D2E] tracking-tight">Delivery Partners</h1>
          <p className="text-gray-500 font-medium">Manage your fleet and live availability</p>
        </div>
        <button onClick={() => setShowModal(true)} disabled={isLoading} className="flex items-center gap-2 bg-[#1A4D2E] text-white px-6 py-3 rounded-2xl font-bold hover:scale-105 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
          <UserPlus size={20} /> Add New Partner
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm">
          <p className="text-gray-400 text-xs font-bold uppercase mb-1">Total Fleet</p>
          <p className="text-3xl font-black text-slate-800">{localRiders.length}</p>
        </div>
        <div className="bg-emerald-50 p-6 rounded-[24px] border border-emerald-100 shadow-sm">
          <p className="text-emerald-600 text-xs font-bold uppercase mb-1">Live Now</p>
          <p className="text-3xl font-black text-emerald-700">{localRiders.filter(r => r.status === 'Online').length}</p>
        </div>
        <div className="bg-blue-50 p-6 rounded-[24px] border border-blue-100 shadow-sm">
          <p className="text-blue-600 text-xs font-bold uppercase mb-1">Active Tasks</p>
          <p className="text-3xl font-black text-blue-700">{localRiders.reduce((acc, r) => acc + (r.activeOrders || 0), 0)}</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input type="text" placeholder="Search by name..." className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl outline-none font-medium shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      {initialLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading delivery partners...</p>
        </div>
      ) : loadError ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3">
          <AlertTriangle className="text-red-500 mt-0.5" size={18} />
          <div className="space-y-3">
            <p className="text-sm font-bold text-red-700">{loadError}</p>
            <button
              onClick={refetchRiders}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest"
            >
              Retry
            </button>
          </div>
        </div>
      ) : filteredRiders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center text-slate-400 font-bold">
          No delivery partners found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRiders.map((rider) => (
          <div key={rider.id} className="bg-white rounded-[32px] border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-full h-1.5 ${rider.status === 'Online' ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            
            <div className="flex justify-between items-start mb-6">
              <div className={`p-4 rounded-2xl ${rider.status === 'Online' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'}`}>
                {rider.vehicle === 'Electric Van' ? <Truck size={28} /> : <Bike size={28} />}
              </div>
              <button onClick={() => handleToggleClick(rider)} disabled={isLoading} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed ${rider.status === 'Online' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                {rider.status === 'Online' ? 'Go Offline' : 'Go Online'}
              </button>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">{rider.name} {rider.status === 'Online' && <Zap size={16} className="text-amber-500 fill-amber-500" />}</h3>
              <p className="text-gray-400 text-sm font-medium flex items-center gap-2"><Phone size={14} /> {rider.phone}</p>
            </div>

            <div 
              onClick={() => rider.activeOrders > 0 && setViewTasks(rider)}
              className={`flex items-center justify-between pt-6 border-t border-gray-50 ${rider.activeOrders > 0 ? 'cursor-pointer hover:bg-gray-50 -mx-6 px-6 transition-colors' : ''}`}
            >
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Active Task</span>
                <span className={`font-bold flex items-center gap-1 ${rider.activeOrders > 0 ? 'text-blue-600' : 'text-slate-700'}`}>
                  {rider.activeOrders} Orders {rider.activeOrders > 0 && <ExternalLink size={12} />}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Vehicle</span>
                <span className="font-bold text-slate-700">{rider.vehicle}</span>
              </div>
            </div>
          </div>
          ))}
        </div>
      )}

      {/* MODAL: VIEW RIDER TASKS */}
      {viewTasks && (
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm z-50">
          <div className="bg-white rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="p-6 bg-blue-600 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black leading-none">{viewTasks.name}'s Tasks</h3>
                <p className="text-xs opacity-80 mt-1 uppercase font-bold tracking-wider">Live Deliveries</p>
              </div>
              <button onClick={() => setViewTasks(null)} className="p-2 hover:bg-white/10 rounded-full"><X size={20}/></button>
            </div>
            <div className="p-4 space-y-3">
              {getRiderOrders(viewTasks.name).map(order => (
                <div key={order.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm border border-gray-100">
                      <Package size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-400 leading-none mb-1">{order.id}</p>
                      <p className="font-bold text-slate-800 leading-none">{order.customerName || order.customer}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-blue-500 uppercase">Out for Delivery</p>
                  </div>
                </div>
              ))}
              {getRiderOrders(viewTasks.name).length === 0 && (
                 <p className="text-center py-4 text-gray-400 font-bold">No active orders found.</p>
              )}
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100">
                <button onClick={() => setViewTasks(null)} className="w-full py-3 bg-white border border-gray-200 text-slate-700 rounded-xl font-black text-sm shadow-sm">CLOSE WINDOW</button>
            </div>
          </div>
        </div>
      )}

      {/* WARNING POPUP */}
      {showWarning && (
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm z-50">
          <div className="bg-white rounded-[32px] w-full max-w-sm p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={32} /></div>
            <h3 className="text-xl font-black text-slate-800 mb-2">Rider Busy</h3>
            <p className="text-gray-500 font-medium mb-6">
              <span className="font-bold text-slate-700">{showWarning.name}</span> cannot go offline with <span className="font-bold text-red-500">{showWarning.activeOrders} active orders</span>.
            </p>
            <button onClick={() => setShowWarning(null)} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black">GOT IT</button>
          </div>
        </div>
      )}

      {/* ADD PARTNER MODAL */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm z-50">
          <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-slate-800">New Partner</h2>
              <button onClick={() => setShowModal(false)} className="p-2 bg-gray-100 rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold outline-none focus:ring-2 focus:ring-green-500" placeholder="Full Name" value={newRider.name} onChange={(e) => setNewRider({...newRider, name: e.target.value})} />
              <input className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold outline-none focus:ring-2 focus:ring-green-500" placeholder="Phone Number" value={newRider.phone} onChange={(e) => setNewRider({...newRider, phone: e.target.value})} />
              <select className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold outline-none focus:ring-2 focus:ring-green-500" value={newRider.vehicle} onChange={(e) => setNewRider({...newRider, vehicle: e.target.value})}>
                <option value="Bike">Motorcycle / Bike</option>
                <option value="Scooter">Scooter</option>
                <option value="Electric Van">Electric Van</option>
              </select>
              <button type="submit" disabled={isLoading} className="w-full py-4 bg-[#1A4D2E] text-white rounded-2xl font-black shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">{isLoading ? 'REGISTERING...' : 'REGISTER PARTNER'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RiderManagement;