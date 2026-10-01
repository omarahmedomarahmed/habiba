import "server-only";

import QRCode from "qrcode";

import { enrolmentAvailable, factorStatus, pendingFactor, type FactorOwner } from "./second-factor";

/**
 * DD-2 B2.4: what `AuthenticatorCard` shows for one person. The QR code is
 * drawn here on the server from the sealed pending secret, so the secret never
 * sits in a client bundle or a log.
 */
export async function authenticatorView(owner: FactorOwner, account: string) {
  const status = await factorStatus(owner);
  const available = enrolmentAvailable();
  const pending = !status.enrolled && available ? await pendingFactor(owner, account) : null;
  const qr = pending ? await QRCode.toDataURL(pending.uri, { margin: 1, errorCorrectionLevel: "M", width: 200 }) : null;
  return {
    enrolled: status.enrolled,
    recoveryLeft: status.recoveryLeft,
    available,
    pending: pending && qr ? { key: pending.key, qr } : null,
  };
}
