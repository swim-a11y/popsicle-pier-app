/*
  Prices. A lesson's price comes from the lesson type booked; nothing here
  looks at partners, so a partner joining or leaving never changes it.
  Bank draft always comes first.
*/
import { cardPricing as defaultMode, type CardPricing } from "@/config";
import type { AppData } from "@/data/types";

export const CARD_PERCENT = 3;

/** "card price": about 3 percent more, rounded down to a quarter so it never goes over. "card fee": one price for both. */
export function cardPriceCents(bankCents: number, mode: CardPricing = defaultMode): number {
  if (mode === "card fee") return bankCents;
  return Math.floor((bankCents * (100 + CARD_PERCENT)) / 2500) * 25;
}

/** Only in "card fee" mode. Never on debit cards in the real app. */
export function cardFeeCents(bankCents: number, mode: CardPricing = defaultMode): number {
  if (mode !== "card fee") return 0;
  return Math.ceil((bankCents * CARD_PERCENT) / 100);
}

export function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export interface PriceLine {
  method: "bank" | "card";
  label: string;
  amount: string;
}

/** Both prices, bank draft first. */
export function priceLines(bankCents: number, mode: CardPricing = defaultMode): PriceLine[] {
  const bank: PriceLine = { method: "bank", label: "Bank draft", amount: money(bankCents) };
  if (mode === "card fee") {
    return [bank, { method: "card", label: "Card", amount: `${money(bankCents)} plus a card fee of ${money(cardFeeCents(bankCents, mode))}` }];
  }
  return [bank, { method: "card", label: "Card", amount: money(cardPriceCents(bankCents, mode)) }];
}

export function lessonTypePrice(data: Readonly<AppData>, lessonTypeId: string | null, mode: CardPricing = defaultMode) {
  const lt = lessonTypeId ? data.lessonTypes.find((l) => l.id === lessonTypeId) : undefined;
  if (!lt) return null;
  return { bankCents: lt.bankDraftCents, cardCents: cardPriceCents(lt.bankDraftCents, mode), lessonType: lt };
}
