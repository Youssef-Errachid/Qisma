package com.qisma.security;

import com.qisma.model.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

@Service
public class JwtService {

    static final String ISSUER = "qisma";

    private final JwtEncoder encoder;
    private final Clock clock;
    private final long accessTtlSeconds;

    public JwtService(JwtEncoder encoder, Clock clock,
                      @Value("${qisma.jwt.access-ttl-seconds}") long accessTtlSeconds) {
        this.encoder = encoder;
        this.clock = clock;
        this.accessTtlSeconds = accessTtlSeconds;
    }

    public String createAccessToken(User user) {
        Instant now = clock.instant();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(ISSUER)
                .subject(user.getId())
                .issuedAt(now)
                .expiresAt(now.plus(Duration.ofSeconds(accessTtlSeconds)))
                .claim("username", user.getUsername())
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    public long accessTtlSeconds() {
        return accessTtlSeconds;
    }
}
