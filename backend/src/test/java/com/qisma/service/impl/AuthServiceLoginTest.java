package com.qisma.service.impl;

import com.qisma.dto.request.LoginRequest;
import com.qisma.dto.response.LoginResponse;
import com.qisma.enums.UserStatus;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.mapper.UserMapper;
import com.qisma.model.User;
import com.qisma.repository.UserRepository;
import com.qisma.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AuthServiceLoginTest {

    private static final Instant NOW = Instant.parse("2026-11-07T12:00:00Z");


    private UserRepository users;
    private JwtService jwt;
    private PasswordEncoder encoder;
    private AuthServiceImpl service;
    private User user;

    @BeforeEach
    void setUp() {
        users = mock(UserRepository.class);
        jwt = mock(JwtService.class);
        encoder = new BCryptPasswordEncoder();
        service = new AuthServiceImpl(users, encoder, new UserMapper(), jwt, Clock.fixed(NOW, ZoneOffset.UTC));

        user = new User();
        user.setId("u1");
        user.setUsername("youssef");
        user.setEmail("youssef@test.com");
        user.setPasswordHash(encoder.encode("Passw0rdOK"));

        when(users.findByEmail("youssef@test.com")).thenReturn(Optional.of(user));
        when(users.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(jwt.createAccessToken(any())).thenReturn("token-123");
        when(jwt.accessTtlSeconds()).thenReturn(900L);
    }

    private ApiException failLogin(String email, String password) {
        return assertThrows(ApiException.class, () -> service.login(new LoginRequest(email, password)));
    }

    @Test
    void successfulLogin_returnsToken_andResetsCounters() {
        user.setFailedLoginCount(3);

        LoginResponse r = service.login(new LoginRequest(" Youssef@Test.com ", "Passw0rdOK"));

        assertEquals("token-123", r.accessToken());
        assertEquals("Bearer", r.tokenType());
        assertEquals(900L, r.expiresIn());
        assertEquals(0, user.getFailedLoginCount());
        assertEquals(NOW, user.getLastLoginAt());
    }

    @Test
    void wrongPassword_andUnknownEmail_giveTheSameError() {
        ApiException wrong = failLogin("youssef@test.com", "WrongPass1");
        ApiException unknown = failLogin("nobody@test.com", "Passw0rdOK");
        assertEquals(ErrorCode.INVALID_CREDENTIALS, wrong.getCode());
        assertEquals(ErrorCode.INVALID_CREDENTIALS, unknown.getCode());
        assertEquals(wrong.getMessage(), unknown.getMessage());
    }

    @Test
    void wrongPassword_incrementsFailures() {
        failLogin("youssef@test.com", "WrongPass1");
        assertEquals(1, user.getFailedLoginCount());
        assertNull(user.getLockedUntil());
    }

    @Test
    void fifthFailure_locksTheAccount() {
        for (int i = 0; i < AuthServiceImpl.MAX_FAILED_LOGINS; i++) {
            failLogin("youssef@test.com", "WrongPass1");
        }
        assertEquals(NOW.plus(AuthServiceImpl.LOCK_DURATION), user.getLockedUntil());
    }


    @Test
    void lockedAccount_isRejected_evenWithCorrectPassword() {
        user.setLockedUntil(NOW.plusSeconds(60));
        assertEquals(ErrorCode.ACCOUNT_LOCKED, failLogin("youssef@test.com", "Passw0rdOK").getCode());
        verify(jwt, never()).createAccessToken(any());
    }

    @Test
    void expiredLock_allowsLogin() {
        user.setLockedUntil(NOW.minusSeconds(1));
        assertEquals("token-123", service.login(new LoginRequest("youssef@test.com", "Passw0rdOK")).accessToken());
        assertNull(user.getLockedUntil());
    }

    @Test
    void disabledUser_cannotLogin() {
        user.setStatus(UserStatus.DISABLED);
        assertEquals(ErrorCode.INVALID_CREDENTIALS, failLogin("youssef@test.com", "Passw0rdOK").getCode());
    }
}
