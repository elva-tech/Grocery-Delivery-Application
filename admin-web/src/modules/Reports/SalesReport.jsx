import React from 'react';
import { useAppState } from '../../context/AppStateContext';
import CustomButton from '../../components/shared/CustomButton';
import { Download, TrendingUp } from 'lucide-react';

const SalesReport = () => {
  const { orders } = useAppState();
  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);

  const exportToCSV = () => {
    const headers = "Order ID,Customer,Amount,Date,Status\n";
    const rows = orders.map(o => `${o.id},${o.customer},${o.total},${o.date},${o.status}`).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Sales_Report.csv';
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-[#1A4D2E]">Business Intelligence</h1>
        <CustomButton onClick={exportToCSV} variant="outline">
          <Download size={18} /> Export CSV
        </CustomButton>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-gray-500 text-sm font-bold uppercase tracking-wider">Total Sales</p>
          <p className="text-3xl font-black text-[#1A4D2E] mt-2">₹{totalRevenue}</p>
          <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold mt-2">
            <TrendingUp size={14} /> +12.5% from last week
          </div>
        </div>
      </div>
      
      {/* List of Sales */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Order</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Revenue</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order.id} className="border-b border-gray-50">
                <td className="px-6 py-4 font-semibold">{order.id}</td>
                <td className="px-6 py-4">₹{order.total}</td>
                <td className="px-6 py-4"><span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-bold">{order.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SalesReport;