export type DeliveryType = 'STANDARD' | 'EXPRESS';

export type DeliveryBillingSettings = {
  deliveryCharge: number;
  expressDeliveryCharge: number;
  freeDeliveryAbove: number;
};

export function isExpressDeliveryChoiceEnabled(
  settings?: Partial<DeliveryBillingSettings> | null,
): boolean {
  return Number(settings?.expressDeliveryCharge) > 0;
}

export function formatDeliveryPrice(amount: number): string {
  return amount > 0 ? `₹${amount}` : 'FREE';
}

export function standardDeliveryPriceLabel(
  subtotal: number,
  settings: Pick<DeliveryBillingSettings, 'deliveryCharge' | 'freeDeliveryAbove'>,
): string {
  return formatDeliveryPrice(
    standardDeliveryFee(subtotal, settings.deliveryCharge, settings.freeDeliveryAbove),
  );
}

/** Free delivery applies only when threshold is set and subtotal is strictly above it. */
export function qualifiesForFreeStandardDelivery(
  subtotal: number,
  freeDeliveryAbove: number,
): boolean {
  const threshold = Number(freeDeliveryAbove) || 0;
  if (threshold <= 0 || subtotal <= 0) return false;
  return subtotal > threshold;
}

export function standardDeliveryFee(
  subtotal: number,
  deliveryCharge: number,
  freeDeliveryAbove: number,
): number {
  if (subtotal <= 0) return 0;
  if (qualifiesForFreeStandardDelivery(subtotal, freeDeliveryAbove)) return 0;
  return Number(deliveryCharge) || 0;
}

export function amountToFreeDelivery(subtotal: number, freeDeliveryAbove: number): number {
  const threshold = Number(freeDeliveryAbove) || 0;
  if (threshold <= 0 || qualifiesForFreeStandardDelivery(subtotal, freeDeliveryAbove)) return 0;
  return Math.max(0, threshold + 1 - subtotal);
}

export function freeDeliveryProgress(subtotal: number, freeDeliveryAbove: number): number {
  const threshold = Number(freeDeliveryAbove) || 0;
  if (threshold <= 0) return 0;
  return Math.min(1, subtotal / (threshold + 1));
}

export function resolveDeliveryFee(
  subtotal: number,
  settings: DeliveryBillingSettings,
  deliveryType: DeliveryType = 'STANDARD',
): {
  deliveryFee: number;
  isFreeDelivery: boolean;
  effectiveDeliveryType: DeliveryType;
} {
  const deliveryCharge = Number(settings.deliveryCharge) || 0;
  const expressDeliveryCharge = Number(settings.expressDeliveryCharge) || 0;
  const freeDeliveryAbove = Number(settings.freeDeliveryAbove) || 0;
  const expressAvailable = expressDeliveryCharge > 0;
  const effectiveDeliveryType =
    expressAvailable && deliveryType === 'EXPRESS' ? 'EXPRESS' : 'STANDARD';
  const standardFee = standardDeliveryFee(subtotal, deliveryCharge, freeDeliveryAbove);
  const deliveryFee =
    effectiveDeliveryType === 'EXPRESS' ? expressDeliveryCharge : standardFee;
  const isFreeDelivery = effectiveDeliveryType === 'STANDARD' && standardFee === 0;

  return { deliveryFee, isFreeDelivery, effectiveDeliveryType };
}
