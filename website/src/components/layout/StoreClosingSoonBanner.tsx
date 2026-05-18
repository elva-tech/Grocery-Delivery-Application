import React from 'react';
import { Clock } from 'lucide-react';
import { WEB_COPY } from '../../constants/copy';
import { storeClosingSoonMessage } from '../../utils/storeHours';

type Props = {
  minutesUntilClose: number;
  closesAt?: string | null;
};

const StoreClosingSoonBanner: React.FC<Props> = ({ minutesUntilClose, closesAt }) => {
  const message = storeClosingSoonMessage(minutesUntilClose, closesAt, {
    closingInMinutes: WEB_COPY.store.closingInMinutes,
    closingAt: WEB_COPY.store.closingAt,
  });

  return (
    <section
      role="status"
      aria-live="polite"
      className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2.5 shadow-md z-[9000]"
    >
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <span className="flex-shrink-0 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
          <Clock size={18} strokeWidth={2.5} aria-hidden />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black uppercase tracking-wider opacity-90">
            {WEB_COPY.store.closingSoonTitle}
          </p>
          <p className="text-sm font-bold leading-snug">{message}</p>
        </div>
      </div>
    </section>
  );
};

export default StoreClosingSoonBanner;
