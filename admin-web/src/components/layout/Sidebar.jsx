import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAppState } from '../../context/AppStateContext';
import { 
  LayoutDashboard, 
  ShoppingBasket, 
  ShoppingCart, 
  Bike,
  ShieldCheck,
  FileText,
  ImageIcon,
  RotateCcw
} from 'lucide-react';
import { APP_CONFIG } from '../../config/appConfig';

const Sidebar = () => {
  const { appSettings } = useAppState();

  const menuSections = [
    {
      title: "Main Menu",
      items: [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard, color: 'text-blue-600' },
        { name: 'Products Inventory', path: '/products', icon: ShoppingBasket, color: 'text-emerald-600' },
      ]
    },
    {
      title: "Operations",
      items: [
        { name: 'Orders', path: '/orders', icon: ShoppingCart, color: 'text-orange-600' },
        { name: 'Data Export', path: '/export', icon: FileText, color: 'text-emerald-600' },
        { name: 'Delivery Partners', path: '/riders', icon: Bike, color: 'text-blue-500' },
        { name: 'App Banners', path: '/banners', icon: ImageIcon, color: 'text-purple-600' },
        // CONDITIONAL RENDER: This logic handles the visibility
        ...(appSettings.allowRefunds ? [{ 
          name: 'Returns & Refunds', 
          path: '/returns', 
          icon: RotateCcw, 
          color: 'text-red-500' 
        }] : []),
      ]
    }
  ];

  return (
    <aside className="w-68 bg-white h-screen flex flex-col border-r border-gray-200 sticky top-0 shadow-sm">
      <div className="p-6 mb-2">
        <div className="flex items-center gap-3 px-2">
          <div className="bg-[#0F2C1D] p-2 rounded-xl shadow-lg shadow-green-900/20">
            <img src={APP_CONFIG.brand.logo} alt="Logo" className="w-6 h-6 brightness-0 invert" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-lg tracking-tight text-gray-900 leading-none">
              {APP_CONFIG.brand.name}
            </span>
            <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest mt-1">
              Admin Portal
            </span>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 overflow-y-auto">
        {menuSections.map((section, idx) => (
          <div key={`section-${idx}`} className="mb-8">
            <h3 className="px-4 text-[11px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-3">
              {section.title}
            </h3>
            
            <div className="space-y-1.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => `
                      group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200
                      ${isActive 
                        ? 'bg-[#0F2C1D] text-white shadow-xl shadow-green-900/30 translate-x-1' 
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon 
                          size={20} 
                          className={`${isActive ? 'text-white' : `${item.color} group-hover:scale-110 transition-transform`}`} 
                        />
                        <span>{item.name}</span>
                        {isActive && (
                          <div className="ml-auto w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;