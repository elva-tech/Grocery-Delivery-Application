import { Building2, Mail, MapPin, Phone, Store } from 'lucide-react';
import type { TenantDetails } from '../../api/tenantApi';
import { getStoreBusinessFields } from '../../utils/storeBusinessFields';

function formatContact(phone: string): string {
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (digits.length === 10) return `+91 ${digits}`;
  return phone;
}

type StoreBusinessDetailsProps = {
  tenant: TenantDetails | null | undefined;
  fallbackStoreName?: string;
};

/**
 * Current-tenant store/business details. Email is omitted when not configured.
 */
export default function StoreBusinessDetails({
  tenant,
  fallbackStoreName = '',
}: StoreBusinessDetailsProps) {
  const fields = getStoreBusinessFields(tenant, fallbackStoreName);
  const rows: { icon: typeof Store; label: string; value: string; href?: string }[] = [];

  if (fields.legalName) {
    rows.push({ icon: Building2, label: 'Legal Name', value: fields.legalName });
  }
  if (fields.storeName) {
    rows.push({ icon: Store, label: 'Store Name', value: fields.storeName });
  }
  if (fields.storeAddress) {
    rows.push({ icon: MapPin, label: 'Address', value: fields.storeAddress });
  }
  if (fields.contactNumber) {
    const digits = fields.contactNumber.replace(/\D/g, '').slice(-10);
    rows.push({
      icon: Phone,
      label: 'Contact',
      value: formatContact(fields.contactNumber),
      href: digits ? `tel:+91${digits}` : undefined,
    });
  }
  if (fields.email) {
    rows.push({
      icon: Mail,
      label: 'Email',
      value: fields.email,
      href: `mailto:${fields.email}`,
    });
  }

  if (rows.length === 0) return null;

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const Icon = row.icon;
        const inner = (
          <>
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#4b6f9e] flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {row.label}
              </p>
              <p className="font-bold text-slate-800 text-sm leading-relaxed mt-0.5 whitespace-pre-line break-words">
                {row.value}
              </p>
            </div>
          </>
        );

        const className =
          'flex items-start gap-4 bg-white border-2 border-slate-100 rounded-[2rem] p-5' +
          (row.href ? ' hover:border-[#4b6f9e] transition-colors group' : '');

        if (row.href) {
          return (
            <a key={row.label} href={row.href} className={className}>
              {inner}
            </a>
          );
        }

        return (
          <div key={row.label} className={className}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
