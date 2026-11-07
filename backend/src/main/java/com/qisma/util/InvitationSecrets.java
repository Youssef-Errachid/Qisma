package com.qisma.util;

import java.security.SecureRandom;
import java.util.Locale;

public final class InvitationSecrets {

    /** 32 symbols, without 0/O/1/I so a code can be read aloud or typed without mistakes. */
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 8;
    private static final SecureRandom RANDOM = new SecureRandom();

    private InvitationSecrets() {
    }

    /** 8 symbols = 40 bits, shown as XXXX-XXXX. */
    public static String newCode() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH + 1);
        for (int i = 0; i < CODE_LENGTH; i++) {
            if (i == CODE_LENGTH / 2) {
                sb.append('-');
            }
            sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }

    /** Codes are case-insensitive and ignore dashes/spaces; long link tokens are kept exactly. */
    public static String normalize(String raw) {
        String trimmed = raw.trim();
        String compact = trimmed.replace("-", "").replace(" ", "");
        return compact.length() <= CODE_LENGTH ? compact.toUpperCase(Locale.ROOT) : trimmed;
    }

    public static String hash(String raw) {
        return TokenUtil.sha256Hex(normalize(raw));
    }
}
