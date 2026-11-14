import { karachiDateTimeKey } from '@aricon/shared';
import {
  sheet,
  type SheetColumn,
  type SheetData,
} from '../spreadsheets/xlsx.js';
import type { CustomerRow } from './customers.repository.js';

const COLUMNS: SheetColumn<CustomerRow>[] = [
  { header: 'Name', width: 24, value: (customer) => customer.name },
  { header: 'Email', width: 30, value: (customer) => customer.email },
  { header: 'Phone', width: 16, value: (customer) => customer.phone ?? '' },
  {
    header: 'Company',
    width: 24,
    value: (customer) => customer.companyName ?? '',
  },
  { header: 'Orders', width: 8, value: (customer) => customer.orderCount },
  {
    header: 'Total spent',
    money: true,
    value: (customer) => customer.totalSpent,
  },
  {
    header: 'Status',
    width: 10,
    value: (customer) =>
      customer.deletedAt
        ? 'Deleted'
        : customer.status === 'active'
          ? 'Active'
          : 'Blocked',
  },
  {
    header: 'Joined (Karachi)',
    width: 18,
    value: (customer) => karachiDateTimeKey(customer.createdAt),
  },
];

/** `GET /api/admin/customers/export` (SPEC §7.3): the customers the list filters select. */
export function customersExportSheet(
  customers: AsyncIterable<CustomerRow>,
): SheetData {
  return sheet('Customers', COLUMNS, customers);
}
