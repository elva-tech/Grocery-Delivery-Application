import React from 'react';

const StatCard = ({ title, value, icon, color }) => (
  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
    </div>
    <div className={`p-3 rounded-lg bg-${color}-50 text-${color}-600`}>
      {icon}
    </div>
  </div>
);

export default StatCard;