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

export function getDefaultVariant(product: Product): ProductVariant {
  const variants = product.variants?.length
    ? product.variants
    : [
        {
          variantId: product.defaultVariantId || product.id,
          label: product.unit || 'Standard',
          price: product.price,
          availableQty: product.stock,
          isDefault: true,
          inStock: product.stock > 0,
        },
      ];
  return variants.find((v) => v.isDefault) || variants[0];
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
