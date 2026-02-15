export const formatCurrency = (amount, currency = '₹') => {
  return `${currency}${Number(amount).toLocaleString('en-IN')}`;
};

export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

export const getStatusColor = (status) => {
  switch (status.toLowerCase()) {
    case 'delivered': return 'bg-green-100 text-green-700';
    case 'out for delivery': return 'bg-blue-100 text-blue-700';
    case 'placed': return 'bg-amber-100 text-amber-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};