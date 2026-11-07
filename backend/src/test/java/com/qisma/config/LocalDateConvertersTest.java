package com.qisma.config;

import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class LocalDateConvertersTest {

    @Test
    void writesTheIsoText_andReadsItBack() {
        LocalDate day = LocalDate.of(2026, 11, 7);
        String text = LocalDateConverters.LocalDateToString.INSTANCE.convert(day);

        assertEquals("2026-11-07", text);
        assertEquals(day, LocalDateConverters.StringToLocalDate.INSTANCE.convert(text));
    }

    @Test
    void everyDayOf2026_roundTripsUnchanged() {
        for (LocalDate d = LocalDate.of(2026, 1, 1); d.getYear() == 2026; d = d.plusDays(1)) {
            String text = LocalDateConverters.LocalDateToString.INSTANCE.convert(d);
            assertEquals(d, LocalDateConverters.StringToLocalDate.INSTANCE.convert(text), text);
        }
    }

    @Test
    void textOrder_isChronologicalOrder() {
        LocalDate earlier = LocalDate.of(2026, 2, 28);
        LocalDate later = LocalDate.of(2026, 11, 7);
        assertTrue(earlier.toString().compareTo(later.toString()) < 0);
        assertTrue(LocalDate.of(2025, 12, 31).toString().compareTo(LocalDate.of(2026, 1, 1).toString()) < 0);
    }

    @Test
    void ourConverterIsTheOneChosenForLocalDate() {
        MongoCustomConversions conversions = new MongoCustomConversions(List.of(
                LocalDateConverters.LocalDateToString.INSTANCE,
                LocalDateConverters.StringToLocalDate.INSTANCE));

        assertEquals(String.class, conversions.getCustomWriteTarget(LocalDate.class).orElseThrow());
    }
}
