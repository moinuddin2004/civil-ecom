import { IDEMPOTENCY_HEADER, type BulkTier, type CustomerOrderDTO, type PricedCart, type Unit, type VariantOptionKey } from '@aricon/shared';
import type { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import type { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Brand } from '../../src/models/brand.model.js';
import { Category } from '../../src/models/category.model.js';
import { DeliveryArea } from '../../src/models/delivery-area.model.js';
import { Product } from '../../src/models/product.model.js';
import { UsersRepository } from '../../src/modules/users/users.repository.js';
import { createStaff, ORIGIN, PASSWORD, uniqueContact } from './auth.js';

/* Data builders for e2e tests: real documents through the real models (so their hooks run). */

export function modelOf<T>(app: INestApplication, name: string): Model<T> {
  return app.get<Model<T>>(getModelToken(name));
}

let sequence = 0;
const next = () => (sequence += 1);

export interface VariantInput {
  sku?: string;
  label?: string;
  options?: Partial<Record<VariantOptionKey, string>>;
  price: number;
  mrp?: number;
  stock: number;
  bulkTiers?: BulkTier[];
  isActive?: boolean;
}

export interface CatalogBasics {
  brandId: Types.ObjectId;
  categoryId: Types.ObjectId;
}

/** One active brand and category to hang products on. */
export async function createCatalogBasics(app: INestApplication): Promise<CatalogBasics> {
  const n = next();
  const brand = await modelOf<Brand>(app, Brand.name).create({ name: `Brand ${n}`, slug: `brand-${n}` });
  const category = await modelOf<Category>(app, Category.name).create({ name: `Category ${n}`, slug: `category-${n}` });
  return { brandId: brand._id, categoryId: category._id };
}

export interface CreatedProduct {
  id: string;
  slug: string;
  variantIds: string[];
}

export async function createProduct(
  app: INestApplication,
  basics: CatalogBasics,
  options: { name?: string; status?: 'active' | 'hidden' | 'archived'; unit?: Unit; variants: VariantInput[] },
): Promise<CreatedProduct> {
  const n = next();
  const product = await modelOf<Product>(app, Product.name).create({
    name: options.name ?? `Test product ${n}`,
    slug: `test-product-${n}`,
    brandId: basics.brandId,
    categoryId: basics.categoryId,
    unit: options.unit ?? 'bag',
    status: options.status ?? 'active',
    variants: options.variants.map((variant, index) => ({
      sku: variant.sku ?? `SKU-${n}-${index}`,
      label: variant.label ?? `Variant ${index + 1}`,
      options: variant.options ?? {},
      mrp: variant.mrp ?? variant.price,
      price: variant.price,
      stock: variant.stock,
      bulkTiers: variant.bulkTiers ?? [],
      isActive: variant.isActive ?? true,
    })),
  });
  return { id: String(product._id), slug: product.slug, variantIds: product.variants.map((variant) => String(variant._id)) };
}

export async function createArea(
  app: INestApplication,
  options: { name?: string; deliveryFee?: number | null; freeDeliveryAbove?: number | null; isServiceable?: boolean } = {},
): Promise<string> {
  const area = await modelOf<DeliveryArea>(app, DeliveryArea.name).create({
    name: options.name ?? `Area ${next()}`,
    deliveryFee: options.deliveryFee ?? null,
    freeDeliveryAbove: options.freeDeliveryAbove ?? null,
    isServiceable: options.isServiceable ?? true,
  });
  return String(area._id);
}

export type Agent = ReturnType<typeof request.agent>;

/** A signed-up (verified) customer and an agent that carries their cookies (and our Origin on writes). */
export async function customerAgent(app: INestApplication): Promise<{ agent: Agent; userId: string; email: string }> {
  const server = app.getHttpServer() as Parameters<typeof request.agent>[0];
  const agent = request.agent(server);
  const contact = uniqueContact();
  const res = await agent
    .post('/api/auth/signup')
    .set('Origin', ORIGIN)
    .send({ name: 'Test Customer', email: contact.email, phone: contact.phone, password: PASSWORD })
    .expect(201);
  const userId = (res.body as { data: { id: string } }).data.id;
  // Signup no longer starts a session; these tests need a normal signed-in customer.
  await app.get(UsersRepository).markEmailVerified(userId);
  await agent
    .post('/api/auth/login')
    .set('Origin', ORIGIN)
    .send({ identifier: contact.email, password: PASSWORD })
    .expect(200);
  return { agent, userId, email: contact.email };
}

/** A signed-in staff member (or admin) and an agent carrying their admin cookies. */
export async function staffAgent(
  app: INestApplication,
  options: Parameters<typeof createStaff>[1] = {},
): Promise<{ agent: Agent; id: string; email: string }> {
  const server = app.getHttpServer() as Parameters<typeof request.agent>[0];
  const staff = await createStaff(app, options);
  const agent = request.agent(server);
  await agent.post('/api/admin/auth/login').set('Origin', ORIGIN).send({ email: staff.email, password: staff.password }).expect(200);
  return { agent, id: staff.id, email: staff.email };
}

/**
 * A customer places a real order through the API (address → cart → checkout), so admin tests start
 * from exactly what production would hold.
 */
export async function placeOrder(
  app: INestApplication,
  options: { areaId: string; lines: { product: CreatedProduct; qty: number; variant?: number }[]; paymentMethod?: 'COD' | 'BANK_TRANSFER' },
): Promise<{ agent: Agent; userId: string; order: CustomerOrderDTO }> {
  const { agent, userId } = await customerAgent(app);
  const [address] = (
    await agent
      .post('/api/account/addresses')
      .set('Origin', ORIGIN)
      .send({ label: 'Site', contactName: 'Ahmed Raza', phone: '03001234567', line1: 'Plot 12, Block 5', areaId: options.areaId })
      .expect(201)
  ).body.data as { id: string }[];
  for (const line of options.lines) {
    await agent
      .put('/api/cart/items')
      .set('Origin', ORIGIN)
      .send({ variantId: line.product.variantIds[line.variant ?? 0], qty: line.qty })
      .expect(200);
  }
  const cart = (await agent.get(`/api/cart?areaId=${options.areaId}`).expect(200)).body.data as PricedCart;
  const res = await agent
    .post('/api/orders')
    .set('Origin', ORIGIN)
    .set(IDEMPOTENCY_HEADER, randomUUID())
    .send({ addressId: address?.id, paymentMethod: options.paymentMethod ?? 'COD', expectedTotal: cart.total })
    .expect(201);
  return { agent, userId, order: res.body.data as CustomerOrderDTO };
}
