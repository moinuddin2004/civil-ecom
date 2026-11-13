import { escapeRegExp, type CartProductData } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Types, type ClientSession, type Model } from 'mongoose';
import { Product, type ProductLean, type Variant } from '../../models/product.model.js';

const { trusted } = mongoose;

type PricingVariant = Pick<Variant, '_id' | 'sku' | 'label' | 'mrp' | 'price' | 'bulkTiers' | 'stock' | 'isActive'>;

/** The product fields cart pricing needs, whatever the product's status. */
export type PricingProduct = Pick<ProductLean, '_id' | 'slug' | 'name' | 'brandName' | 'unit' | 'status'> & {
  images: { key: string }[];
  variants: PricingVariant[];
};

const PRICING_FIELDS = {
  slug: 1,
  name: 1,
  brandName: 1,
  unit: 1,
  status: 1,
  images: { $slice: 1 },
  'variants._id': 1,
  'variants.sku': 1,
  'variants.label': 1,
  'variants.mrp': 1,
  'variants.price': 1,
  'variants.bulkTiers': 1,
  'variants.stock': 1,
  'variants.isActive': 1,
} as const;

/** `computeCart()` input for one line: the product's current data with just the cart's variant. */
export function toCartProductData(product: PricingProduct, variantId: string): CartProductData {
  const variant = product.variants.find((item) => String(item._id) === variantId);
  return {
    productId: String(product._id),
    slug: product.slug,
    name: product.name,
    brandName: product.brandName,
    unit: product.unit,
    status: product.status,
    imageKey: product.images[0]?.key ?? null,
    variant: variant
      ? {
          id: String(variant._id),
          sku: variant.sku,
          label: variant.label,
          mrp: variant.mrp,
          price: variant.price,
          bulkTiers: variant.bulkTiers.map(({ minQty, price }) => ({ minQty, price })),
          stock: variant.stock,
          isActive: variant.isActive,
        }
      : null,
  };
}

/** Product reads for carts (SPEC §6.2–6.3): current prices and stock, including unavailable products. */
@Injectable()
export class CartProductsRepository {
  constructor(@InjectModel(Product.name) private readonly model: Model<Product>) {}

  async findForPricing(productIds: readonly string[], session?: ClientSession): Promise<Map<string, PricingProduct>> {
    const ids = [...new Set(productIds)].filter((id) => Types.ObjectId.isValid(id));
    if (ids.length === 0) return new Map();
    const products = await this.model
      .find({ _id: trusted({ $in: ids.map((id) => new Types.ObjectId(id)) }) }, PRICING_FIELDS, { session })
      .lean<PricingProduct[]>()
      .exec();
    return new Map(products.map((product) => [String(product._id), product]));
  }

  findByVariantId(variantId: string): Promise<PricingProduct | null> {
    return this.model
      .findOne({ 'variants._id': new Types.ObjectId(variantId) }, PRICING_FIELDS)
      .lean<PricingProduct>()
      .exec();
  }

  /** Active products whose name or a variant SKU contains `q`, for staff building an order (SPEC §6.6a). */
  searchActive(q: string, limit: number): Promise<PricingProduct[]> {
    const pattern = new RegExp(escapeRegExp(q), 'i');
    return this.model
      .find({ status: 'active', $or: [{ name: pattern }, { 'variants.sku': pattern }] }, PRICING_FIELDS)
      .sort({ name: 1 })
      .limit(limit)
      .lean<PricingProduct[]>()
      .exec();
  }
}
