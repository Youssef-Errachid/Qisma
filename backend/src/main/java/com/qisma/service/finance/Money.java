package com.qisma.service.finance;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Currency;
import java.util.Objects;

/**
 * Immutable monetary amount stored as a whole number of minor units
 * (e.g. 30000 = 300.00 MAD). Never uses floating point.
 */
public record Money(long minorUnits, Currency currency) implements Comparable<Money> {

    public Money {
        Objects.requireNonNull(currency, "currency must not be null");
        if (currency.getDefaultFractionDigits() < 0) {
            throw new IllegalArgumentException("Unsupported currency: " + currency.getCurrencyCode());
        }
    }

    // ---------- factories ----------

    public static Money of(long minorUnits, String currencyCode) {
        return new Money(minorUnits, Currency.getInstance(currencyCode));
    }

    public static Money zero(Currency currency) {
        return new Money(0L, currency);
    }

    /**
     * Converts a decimal amount (e.g. user input) to Money.
     * Rejects amounts with more decimals than the currency allows (10.005 MAD)
     * and amounts that do not fit in a long.
     */
    public static Money ofDecimal(BigDecimal amount, Currency currency) {
        Objects.requireNonNull(amount, "amount must not be null");
        int digits = currency.getDefaultFractionDigits();
        try {
            BigDecimal scaled = amount.setScale(digits, RoundingMode.UNNECESSARY);
            return new Money(scaled.movePointRight(digits).longValueExact(), currency);
        } catch (ArithmeticException e) {
            throw new IllegalArgumentException(
                    "Invalid amount " + amount.toPlainString() + " for " + currency.getCurrencyCode(), e);
        }
    }

    // ---------- arithmetic ----------

    public Money add(Money other) {
        requireSameCurrency(other);
        return new Money(Math.addExact(minorUnits, other.minorUnits), currency);
    }

    public Money subtract(Money other) {
        requireSameCurrency(other);
        return new Money(Math.subtractExact(minorUnits, other.minorUnits), currency);
    }

    public Money negate() {
        return new Money(Math.negateExact(minorUnits), currency);
    }

    // ---------- queries ----------

    public boolean isZero() {
        return minorUnits == 0L;
    }

    public boolean isPositive() {
        return minorUnits > 0L;
    }

    public boolean isNegative() {
        return minorUnits < 0L;
    }

    /** Decimal view for display only. Never use it for calculations. */
    public BigDecimal toDecimal() {
        return BigDecimal.valueOf(minorUnits, currency.getDefaultFractionDigits());
    }

    @Override
    public int compareTo(Money other) {
        requireSameCurrency(other);
        return Long.compare(minorUnits, other.minorUnits);
    }

    @Override
    public String toString() {
        return toDecimal().toPlainString() + " " + currency.getCurrencyCode();
    }

    private void requireSameCurrency(Money other) {
        Objects.requireNonNull(other, "other must not be null");
        if (!currency.equals(other.currency)) {
            throw new IllegalArgumentException(
                    "Currency mismatch: " + currency.getCurrencyCode() + " vs " + other.currency.getCurrencyCode());
        }
    }
}
