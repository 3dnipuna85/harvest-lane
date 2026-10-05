export const START_PLOTS = 6;
export const MAX_PLOTS = 20;
export const MAX_FARMHANDS = 6;
export const MAX_SELLERS = 5;
export const MAX_MACHINE_LEVEL = 5;
export const MAX_QUEUE = 12;
export const ORDER_COUNT = 3;
export const SKIP_COOLDOWN_MS = 15000;
export const SELLER_INTERVAL_S = 2.5;
/** Truck buyers: seconds between trucks, extra time per item asked for, and the fast-delivery tip. */
/** Trucks are big, rare clients: one every 3 to 6 minutes. */
export const TRUCK_GAP_S: [number, number] = [180, 360];
export const TRUCK_BASE_S = 60;
export const TRUCK_PER_ITEM_S = 6;
export const TRUCK_TIP = 0.3;
