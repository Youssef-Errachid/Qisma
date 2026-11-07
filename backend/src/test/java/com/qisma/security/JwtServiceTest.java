package com.qisma.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.qisma.model.User;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;

import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    private static final SecretKey KEY = new SecretKeySpec(
            "0123456789-0123456789-0123456789-ab".getBytes(StandardCharsets.UTF_8), "HmacSHA256");

    private static JwtService service(Clock clock) {
        return new JwtService(new NimbusJwtEncoder(new ImmutableSecret<>(KEY)), clock, 900L);
    }

    private static JwtDecoder decoder() {
        return NimbusJwtDecoder.withSecretKey(KEY).macAlgorithm(MacAlgorithm.HS256).build();
    }

    private static User user() {
        User u = new User();
        u.setId("u1");
        u.setUsername("youssef");
        return u;

    }

    @Test
    void token_carriesSubjectIssuerAndFifteenMinuteExpiry() {
        Instant now = Instant.now();
        String token = service(Clock.fixed(now, ZoneOffset.UTC)).createAccessToken(user());

        Jwt jwt = decoder().decode(token);
        assertEquals("u1", jwt.getSubject());
        assertEquals("youssef", jwt.getClaimAsString("username"));
        assertEquals("qisma", jwt.getClaimAsString("iss"));
        assertEquals(Duration.ofSeconds(900), Duration.between(jwt.getIssuedAt(), jwt.getExpiresAt()));
    }

    @Test
    void expiredToken_isRejected() {
        Instant longAgo = Instant.now().minus(Duration.ofHours(1));
        String token = service(Clock.fixed(longAgo, ZoneOffset.UTC)).createAccessToken(user());
        assertThrows(JwtException.class, () -> decoder().decode(token));
    }

    @Test
    void tokenSignedWithAnotherKey_isRejected() {
        SecretKey other = new SecretKeySpec(
                "another-secret-another-secret-another!".getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        JwtService foreign = new JwtService(new NimbusJwtEncoder(new ImmutableSecret<>(other)),
                Clock.systemUTC(), 900L);
        assertThrows(JwtException.class, () -> decoder().decode(foreign.createAccessToken(user())));
    }

    @Test
    void tamperedToken_isRejected() {

        String token = service(Clock.systemUTC()).createAccessToken(user());
        String tampered = token.substring(0, token.length() - 3) + "abc";
        assertThrows(JwtException.class, () -> decoder().decode(tampered));
    }
}
