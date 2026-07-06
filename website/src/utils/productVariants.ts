import type { Product, ProductVariant } from '../api/apiSlice';
import type { CartItem } from '../store/slices/cartSlice';

export function cartLineId(productId: string, variantId: string) {
  return `${productId}:${variantId}`;
}

export function parseCartLineId(lineId: string): { productId: string; variantId?: string } {
  const idx = lineId.indexOf(':');
  if (idx === -1) return { productId: lineId };
  return {
    productId: lineId.slice(0, idx),
    variantId: lineId.slice(idx + 1),
  };
}

export function isVariantInStock(variant?: ProductVariant | null): boolean {
  return (variant?.availableQty ?? 0) > 0;
}

function getVariantsList(product: Product): ProductVariant[] {
  if (product.variants?.length) return product.variants;
  return [
    {
      variantId: product.defaultVariantId || product.id,
      label: product.unit || 'Standard',
      price: product.price,
      availableQty: product.stock,
      isDefault: true,
      inStock: product.stock > 0,
    },
  ];
}

/** Variant used for price/label display on cards (may be out of stock). */
export function getDisplayVariant(product: Product): ProductVariant {
  const variants = getVariantsList(product);
  return variants.find((v) => v.isDefault) || variants[0];
}

/** First purchasable variant — default if in stock, else any in-stock option. */
export function getPurchasableVariant(product: Product): ProductVariant | null {
  const variants = getVariantsList(product);
  const defaultInStock = variants.find((v) => v.isDefault && isVariantInStock(v));
  if (defaultInStock) return defaultInStock;
  return variants.find(isVariantInStock) ?? null;
}

export function isProductPurchasable(product: Product): boolean {
  return getPurchasableVariant(product) != null;
}

export function getDefaultVariant(product: Product): ProductVariant {
  return getDisplayVariant(product);
}

export function getVariantById(product: Product, variantId: string): ProductVariant | undefined {
  return product.variants?.find((v) => v.variantId === variantId);
}

export function buildCartPayload(product: Product, variant: ProductVariant): CartItem {
  const image = Array.isArray(product.image) ? product.image[0] : product.image;
  return {
    id: cartLineId(product.id, variant.variantId),
    productId: product.id,
    variantId: variant.variantId,
    name: product.name,
    price: variant.price,
    quantity: 1,
    unit: variant.label,
    image: image || '/placeholder.png',
    stock: variant.availableQty,
  };
}
