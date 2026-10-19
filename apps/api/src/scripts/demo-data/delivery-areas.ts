export interface FixtureDeliveryArea {
  id: string;
  name: string;
  city: string;
  isServiceable: boolean;
  /** null → the store's default delivery fee applies. */
  deliveryFee: number | null;
  freeDeliveryAbove: number | null;
}

/** Karachi delivery areas (SPEC §19); demo fees and thresholds, to be replaced by the client. */
export const DELIVERY_AREAS: FixtureDeliveryArea[] = [
  { id: 'area-gulshan', name: 'Gulshan-e-Iqbal', city: 'Karachi', isServiceable: true, deliveryFee: 400, freeDeliveryAbove: 50_000 },
  { id: 'area-jauhar', name: 'Gulistan-e-Jauhar', city: 'Karachi', isServiceable: true, deliveryFee: 400, freeDeliveryAbove: 50_000 },
  { id: 'area-dha', name: 'DHA', city: 'Karachi', isServiceable: true, deliveryFee: 600, freeDeliveryAbove: 75_000 },
  { id: 'area-clifton', name: 'Clifton', city: 'Karachi', isServiceable: true, deliveryFee: 600, freeDeliveryAbove: 75_000 },
  { id: 'area-pechs', name: 'PECHS', city: 'Karachi', isServiceable: true, deliveryFee: 400, freeDeliveryAbove: 50_000 },
  { id: 'area-north-nazimabad', name: 'North Nazimabad', city: 'Karachi', isServiceable: true, deliveryFee: 500, freeDeliveryAbove: null },
  { id: 'area-nazimabad', name: 'Nazimabad', city: 'Karachi', isServiceable: true, deliveryFee: 500, freeDeliveryAbove: null },
  { id: 'area-fb-area', name: 'FB Area', city: 'Karachi', isServiceable: true, deliveryFee: 500, freeDeliveryAbove: null },
  { id: 'area-saddar', name: 'Saddar', city: 'Karachi', isServiceable: true, deliveryFee: 300, freeDeliveryAbove: 50_000 },
  { id: 'area-korangi', name: 'Korangi', city: 'Karachi', isServiceable: true, deliveryFee: 700, freeDeliveryAbove: null },
  { id: 'area-malir', name: 'Malir', city: 'Karachi', isServiceable: true, deliveryFee: 800, freeDeliveryAbove: null },
  { id: 'area-bahria', name: 'Bahria Town Karachi', city: 'Karachi', isServiceable: false, deliveryFee: null, freeDeliveryAbove: null },
];

export const AREA_BY_ID = new Map(DELIVERY_AREAS.map((area) => [area.id, area]));
