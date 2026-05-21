import React, { useEffect, useState } from 'react';
import { Bell, Loader } from 'lucide-react';
import { apiService } from '../../services/apiService';

const BillingNotificationsPanel = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const res = await apiService.getBillingNotifications();
      setItems(res.data || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  const unread = items.filter((n) => !n.isRead).length;

  const markRead = async (id) => {
    await apiService.markBillingNotificationRead(id);
    setItems((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
        <Loader size={14} className="animate-spin" />
        Loading alerts...
      </div>
    );
  }

  if (!items.length) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
        <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
          <Bell size={16} className="text-emerald-600" />
          Billing alerts
          {unread > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
              {unread}
            </span>
          )}
        </div>
      </div>
      <ul className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
        {items.map((n) => (
          <li
            key={n._id}
            className={`px-4 py-3 text-sm ${n.isRead ? 'text-gray-500' : 'text-gray-800 font-medium bg-emerald-50/40'}`}
          >
            <button
              type="button"
              className="text-left w-full"
              onClick={() => !n.isRead && markRead(n._id)}
            >
              {n.message}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default BillingNotificationsPanel;
