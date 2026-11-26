export type CustomerDetails = {
  fullName: string;
  email: string;
  mobile: string;
  notes: string;
};

export type DetailsErrors = Partial<Record<"fullName" | "email" | "mobile" | "policies", string>>;
export type PaymentErrors = Partial<Record<"proof", string>>;

export const MAX_PROOF_BYTES = 5 * 1024 * 1024;
export const MAX_NOTES = 300;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Accepts 09XXXXXXXXX, 9XXXXXXXXX, +639XXXXXXXXX and 639XXXXXXXXX, with spaces or dashes. */
export function normalizeMobile(raw: string): string | null {
  const digits = raw.replace(/[\s\-()]/g, "");
  const m = /^(?:\+?63|0)?(9\d{9})$/.exec(digits);
  return m ? `0${m[1]}` : null;
}

export function validateDetails(d: CustomerDetails, acceptedPolicies: boolean): DetailsErrors {
  const errors: DetailsErrors = {};
  if (d.fullName.trim().split(/\s+/).filter(Boolean).length < 2 || d.fullName.trim().length < 3) {
    errors.fullName = "Enter your first and last name.";
  }
  if (!d.email.trim()) errors.email = "Enter your email address.";
  else if (!EMAIL_RE.test(d.email.trim())) errors.email = "Enter a valid email address.";
  if (!d.mobile.trim()) errors.mobile = "Enter your mobile number.";
  else if (!normalizeMobile(d.mobile)) errors.mobile = "Enter a valid PH mobile number, e.g. 0917 123 4567.";
  if (!acceptedPolicies) errors.policies = "Please acknowledge the ordering policies to continue.";
  return errors;
}

export function validatePayment(
  proof: { type: string; size: number } | null,
): PaymentErrors {
  const errors: PaymentErrors = {};
  if (!proof) errors.proof = "Upload a screenshot of your payment.";
  else if (!proof.type.startsWith("image/")) errors.proof = "The file must be an image.";
  else if (proof.size > MAX_PROOF_BYTES) errors.proof = "The image must be 5 MB or smaller.";
  return errors;
}
