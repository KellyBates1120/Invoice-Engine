import { NormalizedTransaction } from "@/types"

const FUEL_GRADE_MAP: Record<string, string> = {
  REGULAR: "REG",
  MIDGRADE: "MID",
  PREMIUM: "PREM",
  DIESEL: "DSL",
}

export interface ConexusFuelItem {
  Grade: "REGULAR" | "MIDGRADE" | "PREMIUM" | "DIESEL"
  Quantity: number
  DiscountAmount?: number
}

export interface ConexusNonFuelItem {
  ExtendedPrice: number
  DiscountAmount?: number
}

export interface ConexusLoyaltyAward {
  OfferCode?: string
  DiscountType?: string
  PointsEarned?: number
  PointsRedeemed?: number
}

export interface ConexusTxn {
  TransactionId: string
  SiteId: string
  TransactionDate: string        // ISO datetime
  TransactionType: "FUEL_SALE" | "MERCH_SALE"
  LoyaltyIndicator: boolean
  MemberId?: string
  FuelItem?: ConexusFuelItem
  NonFuelItems?: ConexusNonFuelItem[]
  LoyaltyAward?: ConexusLoyaltyAward
}

export function normalizeConexusTxn(raw: ConexusTxn): NormalizedTransaction {
  const fuelDiscount = raw.FuelItem?.DiscountAmount ?? 0
  const merchDiscount =
    raw.NonFuelItems?.reduce((sum, item) => sum + (item.DiscountAmount ?? 0), 0) ?? 0
  const totalDiscount = fuelDiscount + merchDiscount

  const basketAmount = raw.NonFuelItems?.length
    ? raw.NonFuelItems.reduce((sum, item) => sum + item.ExtendedPrice, 0)
    : undefined

  return {
    id: raw.TransactionId,
    siteId: raw.SiteId,
    txnDate: raw.TransactionDate,
    txnType: raw.TransactionType === "FUEL_SALE" ? "fuel" : "merch",
    loyaltyFlag: raw.LoyaltyIndicator,
    memberId: raw.MemberId,
    fuelGrade: raw.FuelItem ? FUEL_GRADE_MAP[raw.FuelItem.Grade] : undefined,
    gallonQty: raw.FuelItem?.Quantity,
    basketAmount,
    discountAmount: totalDiscount > 0 ? totalDiscount : undefined,
    offerId: raw.LoyaltyAward?.OfferCode,
    discountType: raw.LoyaltyAward?.DiscountType,
    pointsEarned: raw.LoyaltyAward?.PointsEarned,
    pointsRedeemed: raw.LoyaltyAward?.PointsRedeemed,
  }
}
