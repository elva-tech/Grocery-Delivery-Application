import type { Product, ProductVariant } from '@/api/apiSlice';
import type { CartItem } from '@/store/slices/cartSlice';

export function cartLineId(productId: string, variantId: string) {
  return `${productId}:${variantId}`;
}

export function isVariantInStock(variant?: ProductVariant | null): boolean {
  if (!variant) return false;
  if (variant.inStock === false) return false;
  return (variant.availableQty ?? 0) > 0;
}

function getVariantsList(product: Product): ProductVariant[] {
  if (product.variants?.length) return product.variants;
  const qty = product.inStock === false ? 0 : Math.max(0, product.stock ?? 0);
  return [
    {
      variantId: product.defaultVariantId || product.id,
      label: product.unit || 'Standard',
      price: product.price,
      availableQty: qty,
      isDefault: true,
      inStock: product.inStock !== false && qty > 0,
    },
  ];
}

export function getDisplayVariant(product: Product): ProductVariant {
  const variants = getVariantsList(product);
  return variants.find((v) => v.isDefault) || variants[0];
}

export function getPurchasableVariant(product: Product): ProductVariant | null {
  const variants = getVariantsList(product);
  const defaultInStock = variants.find((v) => v.isDefault && isVariantInStock(v));
  if (defaultInStock) return defaultInStock;
  return variants.find(isVariantInStock) ?? null;
}

export function isProductPurchasable(product: Product): boolean {
  if (product.inStock === false) return false;
  return getPurchasableVariant(product) != null;
}

export function getDefaultVariant(product: Product): ProductVariant {
  return getDisplayVariant(product);
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
    image: image || '',
    stock: variant.availableQty,
  };
}
