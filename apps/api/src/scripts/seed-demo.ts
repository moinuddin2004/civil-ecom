import { bannerImageKey, PERMISSION_PRESETS, PAGE_KEYS, productImageFileKey, productImagePrefix, type Permission } from '@aricon/shared';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import mongoose, { Types, type Model } from 'mongoose';
import { AppModule } from '../app.module.js';
import { AppConfig } from '../config/app-config.service.js';
import { AuditLog } from '../models/audit-log.model.js';
import { Brand } from '../models/brand.model.js';
import { Cart } from '../models/cart.model.js';
import { Category } from '../models/category.model.js';
import { Counter } from '../models/counter.model.js';
import { DeliveryArea } from '../models/delivery-area.model.js';
import { Homepage, HOMEPAGE_ID } from '../models/homepage.model.js';
import { Order } from '../models/order.model.js';
import { Product } from '../models/product.model.js';
import { RefreshToken } from '../models/refresh-token.model.js';
import { Rider } from '../models/rider.model.js';
import { Settings, SETTINGS_ID } from '../models/settings.model.js';
import { StockMovement } from '../models/stock-movement.model.js';
import { User } from '../models/user.model.js';
import type { AuditActor } from '../modules/audit/audit.service.js';
import type { Principal } from '../modules/auth/auth.types.js';
import { PasswordHasher } from '../modules/auth/password-hasher.service.js';
import { CartService } from '../modules/cart/cart.service.js';
import { AdminOrdersService } from '../modules/orders/admin/admin-orders.service.js';
import { OrderPlacementService } from '../modules/orders/order-placement.service.js';
import { FileProcessingService } from '../modules/storage/file-processing.service.js';
import { SHORT_CACHE, StorageService } from '../modules/storage/storage.service.js';
import { BRANDS } from './demo-data/brands.js';
import { CATEGORIES } from './demo-data/categories.js';
import { DELIVERY_AREAS } from './demo-data/delivery-areas.js';
import { bannerPlaceholder, categoryColour, productPlaceholder } from './demo-data/placeholder-images.js';
import { PRODUCTS } from './demo-data/products.js';
import { RIDERS } from './demo-data/riders.js';
import { PAGE_CONTENT, STORE_SETTINGS } from './demo-data/settings.js';

/**
 * `pnpm --filter api seed:demo` (SPEC §19): demo catalog, areas, riders, settings, homepage, a demo
 * customer with addresses and orders, and two staff accounts — clearly demo data for development and
 * staging, to be replaced by the client. Orders go through the real placement and status services,
 * so stock, movements and history are exactly what the app itself would write.
 *
 *   pnpm --filter api seed:demo             # refuses if the database already has products
 *   pnpm --filter api seed:demo -- --reset  # deletes the demo data (and its customers/orders) first
 *
 * Refuses when NODE_ENV=production unless `--force`. Product photos and homepage banners are
 * generated placeholders (sharp), stored through the configured storage driver like real uploads.
 */

const DEMO_PASSWORD = 'Demo2026pass';
const CUSTOMER = { name: 'Ahmed Raza', email: 'ahmed.raza@example.com', phone: '+923001234567', companyName: 'Raza Builders' };
const STAFF: { name: string; email: string; phone: string; permissions: readonly Permission[] }[] = [
  { name: 'Sana Malik', email: 'sana@aricon.com.pk', phone: '+923214445566', permissions: PERMISSION_PRESETS.orderManager.permissions },
  { name: 'Usman Tariq', email: 'usman@aricon.com.pk', phone: '+923337778899', permissions: PERMISSION_PRESETS.catalogManager.permissions },
];
const DEMO_EMAILS = [CUSTOMER.email, ...STAFF.map((staff) => staff.email)];

/** `sanitizeFilter` is on: operators in filters must be marked as ours. */
const { trusted } = mongoose;

function print(line = ''): void {
  process.stdout.write(`${line}\n`);
}

function model<T>(app: INestApplicationContext, name: string): Model<T> {
  return app.get<Model<T>>(getModelToken(name));
}

async function reset(app: INestApplicationContext): Promise<void> {
  const users = model<User>(app, User.name);
  const demoUsers = await users.find({ email: trusted({ $in: DEMO_EMAILS }) }, { _id: 1 }).lean().exec();
  const ids = demoUsers.map((user) => user._id);
  for (const name of [
    Product.name,
    Category.name,
    Brand.name,
    DeliveryArea.name,
    Rider.name,
    Order.name,
    StockMovement.name,
    Counter.name,
    Cart.name,
    AuditLog.name,
    Homepage.name,
  ]) {
    await model(app, name).deleteMany({}).exec();
  }
  await model<RefreshToken>(app, RefreshToken.name).deleteMany({ userId: trusted({ $in: ids }) }).exec();
  await users.deleteMany({ _id: trusted({ $in: ids }) }).exec();
  print('Removed the previous demo data.');
}

/** The top-level category a (sub)category slug belongs to, for the placeholder colour. */
function topLevelSlug(slug: string): string {
  return CATEGORIES.find((parent) => parent.slug === slug || parent.children.some((child) => child.slug === slug))?.slug ?? slug;
}

/** One generated photo per product, processed and stored exactly like an upload (SPEC §12). */
async function addPlaceholderPhoto(app: INestApplicationContext, productId: Types.ObjectId, name: string, colour: string): Promise<void> {
  const sizes = await app.get(FileProcessingService).productImageFromBytes(await productPlaceholder(name, colour));
  const prefix = productImagePrefix(String(productId), new Types.ObjectId().toHexString());
  const storage = app.get(StorageService);
  await Promise.all([...sizes].map(([width, body]) => storage.putPublic(productImageFileKey(prefix, width), body, 'image/webp')));
  await model<Product>(app, Product.name).updateOne({ _id: productId }, { $set: { images: [{ key: prefix, alt: `${name} (demo image)` }] } }).exec();
}

const DEMO_BANNERS = [
  { heading: 'Buy more, pay less per bag', subline: 'Bulk prices on cement, delivered across Karachi', link: '/category/cement-plaster', tone: 'blue' },
  { heading: 'Genuine wires and switches', subline: 'Trusted electrical brands for every site', link: '/category/electrical', tone: 'green' },
  { heading: 'Cash on delivery or bank transfer', subline: 'Order today, pay the way that suits you', link: '/pages/delivery-policy', tone: 'sand' },
] as const;

/** Three demo banners (SPEC §19), desktop 1600 px and mobile 800 px wide. */
async function placeholderBanners(app: INestApplicationContext) {
  const files = app.get(FileProcessingService);
  const storage = app.get(StorageService);
  const banners = [];
  for (const [index, banner] of DEMO_BANNERS.entries()) {
    const id = new Types.ObjectId();
    const keys = { desktop: bannerImageKey(String(id), 'desktop'), mobile: bannerImageKey(String(id), 'mobile') };
    for (const variant of ['desktop', 'mobile'] as const) {
      const png = variant === 'desktop' ? await bannerPlaceholder(1600, 600, banner.heading, banner.subline, banner.tone) : await bannerPlaceholder(800, 800, banner.heading, banner.subline, banner.tone);
      const body = await files.bannerImage({ buffer: png, size: png.length }, variant);
      await storage.putPublic(keys[variant], body, 'image/webp', SHORT_CACHE);
    }
    banners.push({ _id: id, desktopKey: keys.desktop, mobileKey: keys.mobile, alt: banner.heading, link: banner.link, isActive: true, sortOrder: index });
  }
  return banners;
}

async function seedCatalog(app: INestApplicationContext): Promise<Map<string, Types.ObjectId>> {
  const categories = model<Category>(app, Category.name);
  const categoryIds = new Map<string, Types.ObjectId>();
  for (const [index, parent] of CATEGORIES.entries()) {
    const created = await categories.create({
      name: parent.name,
      slug: parent.slug,
      description: parent.description ?? undefined,
      showOnHome: parent.showOnHome,
      sortOrder: index,
    });
    categoryIds.set(parent.slug, created._id);
    for (const [childIndex, child] of parent.children.entries()) {
      const sub = await categories.create({
        name: child.name,
        slug: child.slug,
        description: child.description ?? undefined,
        parentId: created._id,
        sortOrder: childIndex,
      });
      categoryIds.set(child.slug, sub._id);
    }
  }

  const brands = model<Brand>(app, Brand.name);
  const brandIds = new Map<string, Types.ObjectId>();
  for (const [index, brand] of BRANDS.entries()) {
    const created = await brands.create({ name: brand.name, slug: brand.slug, sortOrder: index });
    brandIds.set(brand.slug, created._id);
  }

  const products = model<Product>(app, Product.name);
  const movements = model<StockMovement>(app, StockMovement.name);
  const productIds = new Map<string, Types.ObjectId>();
  for (const fixture of PRODUCTS) {
    const brandId = brandIds.get(fixture.brandSlug);
    const categoryId = categoryIds.get(fixture.categorySlug);
    if (!brandId || !categoryId) throw new Error(`Demo product ${fixture.slug} refers to an unknown brand or category.`);
    const created = await products.create({
      name: fixture.name,
      slug: fixture.slug,
      brandId,
      categoryId,
      type: fixture.type ?? undefined,
      unit: fixture.unit,
      description: fixture.description,
      specifications: fixture.specifications,
      isFeatured: fixture.isFeatured,
      status: 'active',
      createdAt: new Date(fixture.createdAt),
      variants: fixture.variants.map((variant) => ({
        sku: variant.sku,
        label: variant.label,
        options: variant.options,
        mrp: variant.mrp,
        price: variant.price,
        bulkTiers: variant.bulkTiers,
        stock: variant.stock,
        lowStockThreshold: variant.lowStockThreshold,
        isActive: variant.isActive,
      })),
    });
    productIds.set(fixture.slug, created._id);
    await addPlaceholderPhoto(app, created._id, fixture.name, categoryColour(topLevelSlug(fixture.categorySlug)));
    // Opening stock is a stock change like any other (SPEC §6.10).
    const opening = created.variants.filter((variant) => variant.stock > 0);
    if (opening.length > 0) {
      await movements.insertMany(
        opening.map((variant) => ({
          productId: created._id,
          variantId: variant._id,
          sku: variant.sku,
          change: variant.stock,
          stockAfter: variant.stock,
          reason: 'ADJUST',
          note: 'Opening stock (demo data)',
          at: new Date(fixture.createdAt),
        })),
      );
    }
  }
  for (const fixture of PRODUCTS) {
    const related = fixture.relatedSlugs.flatMap((slug) => productIds.get(slug) ?? []);
    if (related.length > 0) await products.updateOne({ slug: fixture.slug }, { $set: { relatedProductIds: related } }).exec();
  }

  await model<Homepage>(app, Homepage.name).create({
    _id: HOMEPAGE_ID,
    banners: await placeholderBanners(app),
    featuredProductIds: PRODUCTS.filter((product) => product.isFeatured).slice(0, 8).flatMap((product) => productIds.get(product.slug) ?? []),
    dealProductIds: PRODUCTS.filter((product) => product.isDeal).slice(0, 8).flatMap((product) => productIds.get(product.slug) ?? []),
  });
  print(`Catalog: ${categoryIds.size} categories, ${brandIds.size} brands, ${productIds.size} products.`);
  return productIds;
}

async function seedStore(app: INestApplicationContext): Promise<{ areas: Map<string, Types.ObjectId>; riderId: Types.ObjectId }> {
  await model<Settings>(app, Settings.name).create({
    _id: SETTINGS_ID,
    storeName: STORE_SETTINGS.storeName,
    phone: STORE_SETTINGS.phone,
    whatsapp: STORE_SETTINGS.whatsapp,
    email: STORE_SETTINGS.email,
    address: STORE_SETTINGS.address,
    orderNotificationEmails: [...STORE_SETTINGS.orderNotificationEmails],
    rfpEmail: STORE_SETTINGS.rfpEmail,
    paymentMethods: { ...STORE_SETTINGS.paymentMethods },
    codMaxOrderAmount: STORE_SETTINGS.codMaxOrderAmount,
    defaultDeliveryFee: STORE_SETTINGS.defaultDeliveryFee,
    bankAccounts: STORE_SETTINGS.bankAccounts.map((account) => ({
      bankName: account.bankName,
      accountTitle: account.accountTitle,
      accountNumber: account.accountNumber,
      iban: account.iban,
      raastId: account.raastId,
    })),
    bankTransferInstructions: STORE_SETTINGS.bankTransferInstructions,
    lowStockDefault: STORE_SETTINGS.lowStockDefault,
    pages: Object.fromEntries(PAGE_KEYS.map((key) => [key, PAGE_CONTENT[key]])),
  });

  const areas = new Map<string, Types.ObjectId>();
  for (const [index, area] of DELIVERY_AREAS.entries()) {
    const created = await model<DeliveryArea>(app, DeliveryArea.name).create({
      name: area.name,
      city: area.city,
      isServiceable: area.isServiceable,
      deliveryFee: area.deliveryFee,
      freeDeliveryAbove: area.freeDeliveryAbove,
      sortOrder: index,
    });
    areas.set(area.id, created._id);
  }

  const riders = await model<Rider>(app, Rider.name).create(
    RIDERS.map((rider) => ({ name: rider.name, phone: rider.phone, isActive: rider.isActive })),
  );
  const activeRider = riders.find((rider) => rider.isActive);
  if (!activeRider) throw new Error('The demo data needs an active rider.');
  print(`Store: settings, ${areas.size} delivery areas, ${riders.length} riders.`);
  return { areas, riderId: activeRider._id };
}

interface DemoPeople {
  customerId: Types.ObjectId;
  homeAddressId: Types.ObjectId;
  homeAreaId: Types.ObjectId;
  /** The order manager, acting on the demo orders. */
  manager: Principal;
}

async function seedPeople(
  app: INestApplicationContext,
  areas: Map<string, Types.ObjectId>,
): Promise<DemoPeople> {
  const users = model<User>(app, User.name);
  const passwordHash = await app.get(PasswordHasher).hash(DEMO_PASSWORD);
  const gulshan = areas.get('area-gulshan');
  const dha = areas.get('area-dha');
  if (!gulshan || !dha) throw new Error('The demo data needs the Gulshan and DHA areas.');

  const homeAddressId = new Types.ObjectId();
  const customer = await users.create({
    ...CUSTOMER,
    passwordHash,
    role: 'CUSTOMER',
    emailVerified: true,
    addresses: [
      { _id: homeAddressId, label: 'Home', contactName: CUSTOMER.name, phone: CUSTOMER.phone, line1: 'House 12, Street 5', line2: 'Block 3', landmark: 'Near Al-Noor Mosque', areaId: gulshan, isDefault: true },
      { label: 'Site office', contactName: CUSTOMER.name, phone: CUSTOMER.phone, line1: 'Plot 45, Sector 9', landmark: 'Opposite DHA Phase 6 gate', areaId: dha, isDefault: false },
    ],
  });

  const staff = [];
  for (const member of STAFF) {
    staff.push(await users.create({ ...member, permissions: [...member.permissions], passwordHash, role: 'STAFF', mustChangePassword: false, emailVerified: true }));
  }
  const manager = staff[0];
  if (!manager) throw new Error('No order manager was created.');
  print(`People: 1 demo customer (2 addresses), ${staff.length} staff.`);
  return {
    customerId: customer._id,
    homeAddressId,
    homeAreaId: gulshan,
    manager: {
      userId: String(manager._id),
      email: manager.email,
      audience: 'admin',
      role: 'STAFF',
      status: 'active',
      permissions: [...manager.permissions],
      mustChangePassword: false,
      name: manager.name,
      familyId: randomUUID(),
    },
  };
}

/** Three orders in different states through the real services (SPEC §19). */
async function seedOrders(
  app: INestApplicationContext,
  people: DemoPeople,
  productIds: Map<string, Types.ObjectId>,
  riderId: Types.ObjectId,
): Promise<void> {
  const cart = app.get(CartService);
  const placement = app.get(OrderPlacementService);
  const adminOrders = app.get(AdminOrdersService);
  const products = model<Product>(app, Product.name);
  const customerId = String(people.customerId);
  const actor: AuditActor = { id: people.manager.userId, name: people.manager.name, role: 'STAFF' };

  const place = async (lines: { slug: string; qty: number }[], paymentMethod: 'COD' | 'BANK_TRANSFER') => {
    for (const line of lines) {
      const product = await products.findById(productIds.get(line.slug)).lean().exec();
      const variant = product?.variants.find((item) => item.isActive && item.stock >= line.qty);
      if (!variant) throw new Error(`Demo product ${line.slug} has no variant in stock.`);
      await cart.setItem(customerId, String(variant._id), line.qty);
    }
    // The total the customer would see at checkout for the home address.
    const priced = await cart.get(customerId, String(people.homeAreaId));
    const { order } = await placement.place(
      customerId,
      { addressId: String(people.homeAddressId), paymentMethod, expectedTotal: priced.total },
      randomUUID(),
    );
    return order;
  };

  const delivered = await place(
    [
      { slug: 'lucky-cement-opc-50kg', qty: 30 },
      { slug: 'century-plywood-12mm', qty: 4 },
    ],
    'COD',
  );
  const id = String(delivered._id);
  await adminOrders.changeStatus(people.manager, actor, id, { to: 'CONFIRMED' });
  await adminOrders.assignRider(actor, id, String(riderId));
  await adminOrders.changeStatus(people.manager, actor, id, { to: 'DISPATCHED' });
  await adminOrders.changeStatus(people.manager, actor, id, { to: 'DELIVERED' });
  await adminOrders.codCollected(actor, id, delivered.total, undefined);

  await place([{ slug: 'newage-cable-7-36', qty: 2 }], 'BANK_TRANSFER');
  await place([{ slug: 'boss-upvc-pipe-4inch', qty: 6 }], 'COD');
  print('Orders: 3 for the demo customer (delivered + paid, bank transfer awaiting payment, new).');
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { reset: { type: 'boolean' }, force: { type: 'boolean' } }, allowPositionals: false });
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const config = app.get(AppConfig);
    if (config.isProduction && !values.force) {
      throw new Error('seed:demo is for development and staging. Pass --force to run it with NODE_ENV=production anyway.');
    }
    if (values.reset) await reset(app);
    if ((await model<Product>(app, Product.name).estimatedDocumentCount().exec()) > 0) {
      print('This database already has products. Run with --reset to replace the demo data. Nothing was changed.');
      return;
    }
    if ((await model<User>(app, User.name).countDocuments({ email: trusted({ $in: DEMO_EMAILS }) }).exec()) > 0) {
      print('The demo accounts already exist. Run with --reset to recreate them. Nothing was changed.');
      return;
    }

    const productIds = await seedCatalog(app);
    const { areas, riderId } = await seedStore(app);
    const people = await seedPeople(app, areas);
    await seedOrders(app, people, productIds, riderId);

    print();
    print(`Demo accounts (password for all: ${DEMO_PASSWORD}):`);
    print(`  Customer         ${CUSTOMER.email} / ${CUSTOMER.phone}   → ${config.get('APP_URL')}/login`);
    for (const member of STAFF) print(`  Staff            ${member.email}   → ${config.get('APP_URL')}/admin/login`);
    print('  Admin            create one with: pnpm --filter api seed:admin');
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
