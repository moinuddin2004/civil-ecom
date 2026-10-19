import 'server-only';
import type {
  AdminBrandDTO,
  AdminCategoryDTO,
  AdminCustomerDetailDTO,
  AdminCustomerListItemDTO,
  AdminDeliveryAreaDTO,
  AdminHomepageDTO,
  AdminMeDTO,
  AdminOrderDTO,
  AdminOrderListItemDTO,
  AdminProductDTO,
  AdminProductListItemDTO,
  AdminSettingsDTO,
  ApiListResponse,
  ApiResponse,
  AuditAction,
  AuditEntity,
  AuditLogDTO,
  CodReportDTO,
  DashboardDTO,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Permission,
  PermissionCatalogDTO,
  ProductStatus,
  RiderDTO,
  SalesReportDTO,
  StaffDTO,
  StockMovementDTO,
  StockMovementReason,
  TopProductsReportDTO,
  UserStatus,
} from '@aricon/shared';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { ApiError, isApiError } from './api-errors';
import { apiServer, getAdminMe } from './api-server';
import { routes } from './routes';

/**
 * Admin data for Server Components: `/api/admin/*` reads with the visitor's admin cookies
 * (`no-store`, so nothing staff-only ever lands in a shared cache). The API checks every
 * permission; pages check the same permission first (`can()`) only to show "Access denied"
 * instead of an error.
 */

/* Session */

/** The signed-in staff member; signed out → login, forced password change pending → change it. */
export async function requireStaff(): Promise<AdminMeDTO> {
  const me = await getAdminMe();
  if (!me) redirect(routes.adminLogin());
  if (me.mustChangePassword) redirect(routes.adminChangePassword);
  return me;
}

/** `me.permissions` is already effective (an ADMIN has every permission). */
export function can(me: AdminMeDTO, permission: Permission): boolean {
  return me.permissions.includes(permission);
}

export function canAny(me: AdminMeDTO, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => can(me, permission));
}

export function isAdmin(me: AdminMeDTO): boolean {
  return me.user.role === 'ADMIN';
}

/* Requests */

type QueryValue = string | number | boolean | readonly string[] | undefined | null;

/** `?a=1&b=x` from the defined, non-empty values; arrays are comma-joined (the API's list form). */
function query(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length > 0) search.set(key, value.join(','));
    } else {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/**
 * A staff-only read. If the session ended after the layout checked it (signed out in another tab,
 * blocked, expired), the visitor goes to the login page rather than an error screen.
 */
async function adminRead<T>(path: string): Promise<T> {
  try {
    return await apiServer<T>(`/api/admin${path}`);
  } catch (error) {
    if (isApiError(error) && error.status === 401) redirect(routes.adminLogin());
    throw error;
  }
}

async function getData<T>(path: string): Promise<T> {
  const response = await adminRead<ApiResponse<T>>(path);
  return response.data;
}

function getList<T, Extra extends object = object>(path: string): Promise<ApiListResponse<T> & Extra> {
  return adminRead<ApiListResponse<T> & Extra>(path);
}

const OBJECT_ID = /^[a-f0-9]{24}$/i;

/** An id from the URL that can't be an id is a 404 without a request (use with `orNotFound()`). */
function byId<T>(id: string, load: (id: string) => Promise<T>): Promise<T> {
  return OBJECT_ID.test(id) ? load(id) : Promise.reject(new ApiError('NOT_FOUND', 404, "We couldn't find that."));
}

/* Dashboard and permissions (any signed-in staff; the API leaves out widgets they can't see) */

export function getDashboard(): Promise<DashboardDTO> {
  return getData<DashboardDTO>('/dashboard');
}

export function getPermissionCatalog(): Promise<PermissionCatalogDTO> {
  return getData<PermissionCatalogDTO>('/permissions');
}

/* Orders */

export interface AdminOrderListParams {
  status?: readonly OrderStatus[];
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  from?: string;
  to?: string;
  areaId?: string;
  riderId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export type OrderStatusCounts = Record<OrderStatus | 'all', number>;

/** Orders for the list, plus counts per status for the tabs (independent of `status`). */
export function getAdminOrders(params: AdminOrderListParams = {}) {
  return getList<AdminOrderListItemDTO, { statusCounts: OrderStatusCounts }>(`/orders${query({ ...params })}`);
}

/** Cached per request, so `generateMetadata` and the page share one call. */
export const getAdminOrder = cache(
  (id: string): Promise<AdminOrderDTO> => byId(id, (valid) => getData<AdminOrderDTO>(`/orders/${valid}`)),
);

/* Products and stock */

export interface AdminProductListParams {
  q?: string;
  categoryId?: string;
  brandId?: string;
  status?: ProductStatus | 'all';
  lowStock?: boolean;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export function getAdminProducts(params: AdminProductListParams = {}) {
  return getList<AdminProductListItemDTO>(`/products${query({ ...params, lowStock: params.lowStock || undefined })}`);
}

export const getAdminProduct = cache(
  (id: string): Promise<AdminProductDTO> => byId(id, (valid) => getData<AdminProductDTO>(`/products/${valid}`)),
);

export interface StockMovementListParams {
  sku?: string;
  productId?: string;
  reason?: StockMovementReason;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function getStockMovements(params: StockMovementListParams = {}) {
  return getList<StockMovementDTO>(`/stock-movements${query({ ...params })}`);
}

/* Catalog */

export function getAdminCategories(): Promise<AdminCategoryDTO[]> {
  return getData<AdminCategoryDTO[]>('/categories');
}

export function getAdminBrands(): Promise<AdminBrandDTO[]> {
  return getData<AdminBrandDTO[]>('/brands');
}

export function getAdminHomepage(): Promise<AdminHomepageDTO> {
  return getData<AdminHomepageDTO>('/homepage');
}

/* Delivery */

export function getAdminDeliveryAreas(): Promise<AdminDeliveryAreaDTO[]> {
  return getData<AdminDeliveryAreaDTO[]>('/delivery-areas');
}

export function getRiders(): Promise<RiderDTO[]> {
  return getData<RiderDTO[]>('/riders');
}

/* Customers and staff */

export interface AdminCustomerListParams {
  q?: string;
  status?: UserStatus;
  page?: number;
  pageSize?: number;
}

export function getAdminCustomers(params: AdminCustomerListParams = {}) {
  return getList<AdminCustomerListItemDTO>(`/customers${query({ ...params })}`);
}

export function getAdminCustomer(id: string): Promise<AdminCustomerDetailDTO> {
  return byId(id, (valid) => getData<AdminCustomerDetailDTO>(`/customers/${valid}`));
}

export function getStaffList(): Promise<StaffDTO[]> {
  return getData<StaffDTO[]>('/staff');
}

/* Reports */

export function getSalesReport(from: string, to: string, groupBy: 'day' | 'month' = 'day'): Promise<SalesReportDTO> {
  return getData<SalesReportDTO>(`/reports/sales${query({ from, to, groupBy })}`);
}

export function getTopProductsReport(from: string, to: string, limit = 20): Promise<TopProductsReportDTO> {
  return getData<TopProductsReportDTO>(`/reports/top-products${query({ from, to, limit })}`);
}

export function getCodReport(from: string, to: string): Promise<CodReportDTO> {
  return getData<CodReportDTO>(`/reports/cod${query({ from, to })}`);
}

/* ADMIN only: settings and the audit log */

export function getAdminSettings(): Promise<AdminSettingsDTO> {
  return getData<AdminSettingsDTO>('/settings');
}

export interface AuditLogListParams {
  actorId?: string;
  entity?: AuditEntity;
  entityId?: string;
  action?: AuditAction;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function getAuditLogs(params: AuditLogListParams = {}) {
  return getList<AuditLogDTO>(`/audit-logs${query({ ...params })}`);
}
