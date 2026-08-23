-- Adds the fourth official Stock Type: Common Product — for company-arranged
-- procurement / one-off purchases that aren't part of regular Equipment,
-- Consumption, or Parts inventory (see src/lib/stock-types.ts's StockType /
-- CATEGORIES_FOR_STOCK_TYPE, which maps this 1:1 to StockType "COMMON_PRODUCT"
-- the same way GENERAL maps 1:1 to "PARTS").
--
-- Purely additive — existing EQUIPMENT/CONSUMPTION/PARTS rows and every
-- historical SparePart/Quotation/Delivery/Invoice record are untouched.
ALTER TYPE "PartCategory" ADD VALUE IF NOT EXISTS 'COMMON_PRODUCT';
