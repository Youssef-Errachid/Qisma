package com.qisma.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class InvitationSecretsTest {

    @Test
    void newCode_hasTheExpectedShape_andNeverUsesConfusingSymbols() {
        for (int i = 0; i < 500; i++) {
            String code = InvitationSecrets.newCode();
            assertTrue(code.matches("[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}"), code);
        }
    }

    @Test
    void code_isCaseDashAndSpaceInsensitive() {
        String expected = InvitationSecrets.hash("ABCD-2345");
        assertEquals(expected, InvitationSecrets.hash("abcd-2345"));
        assertEquals(expected, InvitationSecrets.hash("ABCD2345"));
        assertEquals(expected, InvitationSecrets.hash("  abcd 2345 "));
        assertNotEquals(expected, InvitationSecrets.hash("ABCD-2346"));
    }

    @Test
    void longToken_isKeptExactly_notUppercased() {
        String token = TokenUtil.randomToken();

        assertEquals(token, InvitationSecrets.normalize(token));
        assertNotEquals(InvitationSecrets.hash(token), InvitationSecrets.hash(token.toUpperCase()));
    }

    @Test
    void hash_isNotTheSecret() {
        assertNotEquals("ABCD2345", InvitationSecrets.hash("ABCD-2345"));
        assertEquals(64, InvitationSecrets.hash("ABCD-2345").length());
    }
}
