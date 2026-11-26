"use client";

import { useSyncExternalStore } from "react";
import type { CustomerDetails } from "./validation";
import type { PlacedOrder } from "./order";

const STORAGE_KEY = "ilaos-checkout-v1";

export type CheckoutState = {
  details: CustomerDetails;
  acceptedPolicies: boolean;
  couponCode: string | null;
  /** Held in memory only; files can't be persisted to sessionStorage. */
  proof: File | null;
  proofUrl: string | null;
  placedOrder: PlacedOrder | null;
};

const INITIAL: CheckoutState = {
  details: { fullName: "", email: "", mobile: "", notes: "" },
  acceptedPolicies: false,
  couponCode: null,
  proof: null,
  proofUrl: null,
  placedOrder: null,
};

const listeners = new Set<() => void>();
let state: CheckoutState | null = null;

function read(): CheckoutState {
  if (state !== null) return state;
  let next = INITIAL;
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && typeof saved === "object") next = { ...INITIAL, ...saved, proof: null, proofUrl: null };
  } catch {
    // Corrupt or unavailable storage: start fresh.
  }
  state = next;
  return next;
}

function update(patch: Partial<CheckoutState>) {
  const next = { ...read(), ...patch };
  state = next;
  try {
    const persisted: Partial<CheckoutState> = { ...next };
    delete persisted.proof;
    delete persisted.proofUrl;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // Storage unavailable; state still lives in memory.
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useCheckout(): CheckoutState {
  return useSyncExternalStore(subscribe, read, () => INITIAL);
}

/** True once running in the browser, so client-only state is safe to act on. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export const setDetails = (details: CustomerDetails) => update({ details });
export const setAcceptedPolicies = (acceptedPolicies: boolean) => update({ acceptedPolicies });
export const setCouponCode = (couponCode: string | null) => update({ couponCode });
export const setPlacedOrder = (placedOrder: PlacedOrder | null) => update({ placedOrder });

export function setProof(file: File | null) {
  const prev = read().proofUrl;
  if (prev) URL.revokeObjectURL(prev);
  update({ proof: file, proofUrl: file ? URL.createObjectURL(file) : null });
}

/** Clears the entered details after an order, keeping the placed order for the success page. */
export function resetAfterOrder(placedOrder: PlacedOrder) {
  const prev = read().proofUrl;
  if (prev) URL.revokeObjectURL(prev);
  update({ ...INITIAL, placedOrder });
}
