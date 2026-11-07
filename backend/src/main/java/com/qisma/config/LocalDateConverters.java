package com.qisma.config;

import org.springframework.core.convert.converter.Converter;
import org.springframework.data.convert.ReadingConverter;
import org.springframework.data.convert.WritingConverter;

import java.time.LocalDate;

/**
 * Stores a LocalDate as its ISO text ("2026-11-07") instead of a java.util.Date. A Date depends on the
 * JVM time zone, so the same accounting day could shift by one between a laptop and a container.
 * ISO text is zone-free and sorts chronologically, which the date-range filters rely on.
 */
public final class LocalDateConverters {

    private LocalDateConverters() {
    }

    @WritingConverter
    public enum LocalDateToString implements Converter<LocalDate, String> {
        INSTANCE;

        @Override
        public String convert(LocalDate source) {
            return source.toString();
        }
    }

    @ReadingConverter
    public enum StringToLocalDate implements Converter<String, LocalDate> {
        INSTANCE;

        @Override
        public LocalDate convert(String source) {
            return LocalDate.parse(source);
        }
    }
}
