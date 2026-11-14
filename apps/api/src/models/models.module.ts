import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLog, AuditLogSchema } from './audit-log.model.js';
import { Brand, BrandSchema } from './brand.model.js';
import { Cart, CartSchema } from './cart.model.js';
import { Category, CategorySchema } from './category.model.js';
import { Counter, CounterSchema } from './counter.model.js';
import { DeliveryArea, DeliveryAreaSchema } from './delivery-area.model.js';
import { EmailVerificationToken, EmailVerificationTokenSchema } from './email-verification-token.model.js';
import { EmailVerificationMigration } from './email-verification-migration.js';
import { Homepage, HomepageSchema } from './homepage.model.js';
import { ImportJob, ImportJobSchema } from './import-job.model.js';
import { Order, OrderSchema } from './order.model.js';
import { PasswordReset, PasswordResetSchema } from './password-reset.model.js';
import { Product, ProductSchema } from './product.model.js';
import { RefreshToken, RefreshTokenSchema } from './refresh-token.model.js';
import { Rider, RiderSchema } from './rider.model.js';
import { Settings, SettingsSchema } from './settings.model.js';
import { StockMovement, StockMovementSchema } from './stock-movement.model.js';
import { User, UserSchema } from './user.model.js';
import { UserContactIndexMigration } from './user-contact-index-migration.js';

/**
 * Every collection (SPEC §5), registered once and available to every module's repositories via
 * `@InjectModel(Name.name)`. Indexes declared on the schemas are built at startup (`autoIndex`).
 */
const MODELS = MongooseModule.forFeature([
  { name: User.name, schema: UserSchema },
  { name: RefreshToken.name, schema: RefreshTokenSchema },
  { name: PasswordReset.name, schema: PasswordResetSchema },
  { name: EmailVerificationToken.name, schema: EmailVerificationTokenSchema },
  { name: Category.name, schema: CategorySchema },
  { name: Brand.name, schema: BrandSchema },
  { name: Product.name, schema: ProductSchema },
  { name: Cart.name, schema: CartSchema },
  { name: DeliveryArea.name, schema: DeliveryAreaSchema },
  { name: Rider.name, schema: RiderSchema },
  { name: Order.name, schema: OrderSchema },
  { name: Counter.name, schema: CounterSchema },
  { name: StockMovement.name, schema: StockMovementSchema },
  { name: Homepage.name, schema: HomepageSchema },
  { name: Settings.name, schema: SettingsSchema },
  { name: ImportJob.name, schema: ImportJobSchema },
  { name: AuditLog.name, schema: AuditLogSchema },
]);

@Global()
@Module({
  imports: [MODELS],
  providers: [UserContactIndexMigration, EmailVerificationMigration],
  exports: [MODELS],
})
export class ModelsModule {}
