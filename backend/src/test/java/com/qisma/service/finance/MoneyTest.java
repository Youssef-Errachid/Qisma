package com.qisma.service.finance;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Currency;

import static org.junit.jupiter.api.Assertions.*;

class MoneyTest {

    private static final Currency MAD = Currency.getInstance("MAD");

    @Test
    void ofDecimal_convertsToMinorUnits() {
        assertEquals(30000L, Money.ofDecimal(new BigDecimal("300.00"), MAD).minorUnits());
        assertEquals(1050L, Money.ofDecimal(new BigDecimal("10.5"), MAD).minorUnits());
        assertEquals(1L, Money.ofDecimal(new BigDecimal("0.01"), MAD).minorUnits());
    }

    @Test
    void ofDecimal_rejectsMoreDecimalsThanCurrencyAllows() {
        assertThrows(IllegalArgumentException.class,
                () -> Money.ofDecimal(new BigDecimal("10.005"), MAD));
    }

    @Test
    void ofDecimal_rejectsAmountTooLargeForLong() {
        assertThrows(IllegalArgumentException.class,
                () -> Money.ofDecimal(new BigDecimal("999999999999999999999.00"), MAD));
    }


    @Test
    void ofDecimal_respectsCurrencyWithZeroDecimals() {
        Currency jpy = Currency.getInstance("JPY");
        assertEquals(500L, Money.ofDecimal(new BigDecimal("500"), jpy).minorUnits());
        assertThrows(IllegalArgumentException.class,
                () -> Money.ofDecimal(new BigDecimal("500.5"), jpy));
    }

    @Test
    void toDecimal_andToString_formatCorrectly() {
        Money m = Money.of(30000L, "MAD");
        assertEquals(new BigDecimal("300.00"), m.toDecimal());
        assertEquals("300.00 MAD", m.toString());
        assertEquals("0.05 MAD", Money.of(5L, "MAD").toString());
    }

    @Test
    void add_isExact_whereDoubleIsNot() {
        // 0.1 + 0.2 with double = 0.30000000000000004
        Money sum = Money.of(10L, "MAD").add(Money.of(20L, "MAD"));
        assertEquals(30L, sum.minorUnits());
    }

    @Test
    void subtract_andNegate_work() {
        Money a = Money.of(500L, "MAD");
        Money b = Money.of(200L, "MAD");
        assertEquals(300L, a.subtract(b).minorUnits());
        assertEquals(-300L, b.subtract(a).minorUnits());
        assertEquals(-500L, a.negate().minorUnits());
    }


    @Test
    void signQueries_areConsistent() {
        assertTrue(Money.zero(MAD).isZero());
        assertTrue(Money.of(1L, "MAD").isPositive());
        assertTrue(Money.of(-1L, "MAD").isNegative());
        assertFalse(Money.zero(MAD).isPositive());
        assertFalse(Money.zero(MAD).isNegative());
    }

    @Test
    void differentCurrencies_cannotBeCombined() {
        Money mad = Money.of(100L, "MAD");
        Money eur = Money.of(100L, "EUR");
        assertThrows(IllegalArgumentException.class, () -> mad.add(eur));
        assertThrows(IllegalArgumentException.class, () -> mad.subtract(eur));
        assertThrows(IllegalArgumentException.class, () -> mad.compareTo(eur));
    }

    @Test
    void overflow_isDetected_notWrappedSilently() {
        Money max = Money.of(Long.MAX_VALUE, "MAD");
        assertThrows(ArithmeticException.class, () -> max.add(Money.of(1L, "MAD")));
        assertThrows(ArithmeticException.class, () -> Money.of(Long.MIN_VALUE, "MAD").negate());
    }

    @Test
    void compareTo_ordersByAmount() {
        assertTrue(Money.of(100L, "MAD").compareTo(Money.of(200L, "MAD")) < 0);
        assertEquals(0, Money.of(100L, "MAD").compareTo(Money.of(100L, "MAD")));
    }

    @Test

    void equality_isValueBased() {
        assertEquals(Money.of(100L, "MAD"), Money.of(100L, "MAD"));
        assertNotEquals(Money.of(100L, "MAD"), Money.of(100L, "EUR"));
    }

    @Test
    void unsupportedPseudoCurrency_isRejected() {
        assertThrows(IllegalArgumentException.class, () -> Money.of(100L, "XXX"));
    }
}