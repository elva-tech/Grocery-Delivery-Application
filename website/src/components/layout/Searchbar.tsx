import React from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ value, onChange }) => {
  return (
    <div className="flex-1 max-w-[600px] px-4">
      <div className="relative flex items-center bg-ui-gray border border-ui-border rounded-xl px-3 py-2.5 group focus-within:bg-white focus-within:shadow-sm transition-all">
        <Search size={18} className="text-text-muted group-focus-within:text-brand-blue" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder='Search "milk", "bread" or "curd"'
          className="bg-transparent border-none outline-none w-full ml-3 text-sm text-text-main placeholder:text-text-muted font-medium"
        />
      </div>
    </div>
  );
};

export default SearchBar;