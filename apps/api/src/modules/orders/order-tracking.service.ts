import type { OrderTrackingDTO } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import { OrdersRepository } from './orders.repository.js';

/** One answer for every code that matches no order, so the endpoint says nothing else about orders. */
const NOT_FOUND = "We couldn't find an order with this tracking code. Check the 6 digits and try again.";

/**
 * Public order tracking (SPEC §6.6b). The 6-digit tracking code of the order is the only thing
 * asked for; only the status trail and the rider's name come back (no address, items, prices or
 * customer details), and the endpoint is rate limited.
 */
@Injectable()
export class OrderTrackingService {
  constructor(private readonly orders: OrdersRepository) {}

  async track(code: string): Promise<OrderTrackingDTO> {
    const order = await this.orders.findOne({ trackingCode: code });
    if (!order) throw AppError.notFound(NOT_FOUND);

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      history: order.statusHistory.map((entry) => ({ status: entry.status, at: entry.at.toISOString() })),
      riderName: (order.status === 'DISPATCHED' || order.status === 'DELIVERED') && order.rider ? order.rider.name : null,
    };
  }
}
