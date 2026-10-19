export interface FixtureRider {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
}

/** Demo riders (SPEC §19), named consistently with the ones already referenced on demo orders. */
export const RIDERS: FixtureRider[] = [
  { id: 'rider-aslam', name: 'Aslam Khan', phone: '+923331112222', isActive: true },
  { id: 'rider-bilal', name: 'Bilal Ahmed', phone: '+923339998877', isActive: true },
  { id: 'rider-imran', name: 'Imran Sheikh', phone: '+923214441234', isActive: false },
];

export const RIDER_BY_ID = new Map(RIDERS.map((rider) => [rider.id, rider]));
