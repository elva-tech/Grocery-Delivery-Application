import React from 'react';
import { useAppState } from '../../context/AppStateContext';
import { APP_CONFIG } from '../../config/appConfig';

const InventoryStats = () => {
  const { products } = useAppState();
  const lowStock = products.filter(p => p.stock < APP_CONFIG.settings.lowStockThreshold);

  return (
    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-6">
      <h3 className="text-amber-800 font-bold flex items-center gap-2">
        ⚠️ Low Stock Alerts ({lowStock.length})
      </h3>
      <div className="mt-2 space-y-2">
        {lowStock.map(item => (
          <div key={item.id} className="text-sm text-amber-700 flex justify-between">
            <span>{item.name}</span>
            <span className="font-bold">{item.stock} left</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InventoryStats;