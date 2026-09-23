import { randomBytes } from "node:crypto";

// 10 chars from an alphabet without look-alikes (0/O, 1/l/I) — easy to read out over the phone.
export function tempPassword() {
  const abc = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return [...randomBytes(10)].map((b) => abc[b % abc.length]).join("");
}
