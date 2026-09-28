/**
 * app/api/_lib/mandate.ts — POST /api/mandates body validation and Mandate construction.
 * Pure (zod + types only) so tests/mandate-request.test.ts can run it without a server.
 *
 * Dates: any string Date.parse understands (ISO with Z or an offset, datetime-local, …) is
 * accepted and normalized with new Date(s).toISOString(); expiresAt must be after startsAt.
 * (zod 4's z.string().datetime() would reject datetime-local and +09:00 offsets.)
 */
import { z } from "zod";
import type { Hex, Mandate, Merchant } from "../../../contracts/api";

const isoDate = z
  .string()
  .trim()
  .min(1)
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: "must be a date (ISO 8601 recommended)" })
  .transform((s) => new Date(s).toISOString());

const unique = (xs: string[]) => [...new Set(xs)];
const ids = z.array(z.string().trim().min(1).max(64)).max(100).transform(unique);

export const CreateMandateSchema = z
  .object({
    principal: z.string().trim().min(1).max(120),
    traveler: z.string().trim().min(1).max(120),
    budgetUsd: z.number().positive().max(1_000_000),
    perTxCapUsd: z.number().positive().max(1_000_000),
    allowedMerchantIds: ids,
    allowedCategories: ids,
    blockedKeywords: ids,
    startsAt: isoDate,
    expiresAt: isoDate,
    id: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,64}$/, { message: "id may contain letters, digits, _ and - (max 64)" })
      .optional(),
  })
  .refine((b) => Date.parse(b.expiresAt) > Date.parse(b.startsAt), {
    message: "expiresAt must be after startsAt",
    path: ["expiresAt"],
  });

export type CreateMandateBody = z.output<typeof CreateMandateSchema>;

/** Merchant ids in the request that are not in the catalog (the request must be refused). */
export function unknownMerchantIds(body: CreateMandateBody, catalog: Merchant[]): string[] {
  const known = new Set(catalog.map((m) => m.id));
  return body.allowedMerchantIds.filter((id) => !known.has(id));
}

/** The Mandate that gets hashed and anchored: catalog snapshot + env agent wallet + status active. */
export function buildMandate(body: CreateMandateBody, catalog: Merchant[], agentWallet: Hex, now: Date): Mandate {
  return {
    id: body.id ?? `man_${now.getTime()}`,
    principal: body.principal,
    traveler: body.traveler,
    agentWallet,
    budgetUsd: body.budgetUsd,
    perTxCapUsd: body.perTxCapUsd,
    allowedMerchantIds: body.allowedMerchantIds,
    allowedCategories: body.allowedCategories,
    blockedKeywords: body.blockedKeywords,
    startsAt: body.startsAt,
    expiresAt: body.expiresAt,
    catalog: catalog.map((m) => ({ id: m.id, name: m.name, category: m.category, wallet: m.wallet })),
    status: "active",
  };
}
