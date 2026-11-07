
package com.qisma.service.impl;

import com.qisma.dto.request.LoginRequest;
import com.qisma.dto.response.LoginResponse;
import com.qisma.dto.response.UserResponse;
import com.qisma.enums.Language;
import com.qisma.enums.UserStatus;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.mapper.UserMapper;
import com.qisma.model.User;
import com.qisma.repository.UserRepository;
import com.qisma.security.JwtService;
import com.qisma.security.RefreshTokenService;
import com.qisma.service.AuthService;
import com.qisma.service.AuthSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SessionServiceImplTest {

    private AuthService authService;
    private RefreshTokenService refreshTokens;
    private UserRepository users;
    private JwtService jwt;

    private SessionServiceImpl service;
    private User user;

    @BeforeEach
    void setUp() {
        authService = mock(AuthService.class);
        refreshTokens = mock(RefreshTokenService.class);
        users = mock(UserRepository.class);
        jwt = mock(JwtService.class);
        service = new SessionServiceImpl(authService, refreshTokens, users, jwt, new UserMapper());

        user = new User();
        user.setId("u1");
        user.setUsername("youssef");
        user.setEmail("youssef@test.com");

        when(jwt.createAccessToken(any())).thenReturn("access-2");
        when(jwt.accessTtlSeconds()).thenReturn(900L);
    }

    @Test
    void login_returnsTheResponseAndAFreshRefreshToken() {
        UserResponse userResponse = new UserResponse("u1", "youssef", "Y", "youssef@test.com", null,
                Language.FR, Instant.now());
        when(authService.login(any())).thenReturn(new LoginResponse("access-1", "Bearer", 900L, userResponse));
        when(refreshTokens.issue("u1")).thenReturn("refresh-1");

        AuthSession session = service.login(new LoginRequest("youssef@test.com", "Passw0rdOK"));

        assertEquals("access-1", session.response().accessToken());
        assertEquals("refresh-1", session.refreshToken());
    }


    @Test
    void refresh_rotatesTheToken_andIssuesANewAccessToken() {
        when(refreshTokens.rotate("old")).thenReturn(new RefreshTokenService.Rotated("u1", "f1", "new"));
        when(users.findById("u1")).thenReturn(Optional.of(user));

        AuthSession session = service.refresh("old");

        assertEquals("access-2", session.response().accessToken());
        assertEquals("new", session.refreshToken());
        assertEquals("u1", session.response().user().id());
    }

    @Test
    void refresh_withoutAToken_isRejected() {
        when(refreshTokens.rotate(null)).thenThrow(
                new ApiException(ErrorCode.INVALID_REFRESH_TOKEN, "Invalid or expired refresh token"));

        ApiException e = assertThrows(ApiException.class, () -> service.refresh(null));
        assertEquals(ErrorCode.INVALID_REFRESH_TOKEN, e.getCode());
        verify(jwt, never()).createAccessToken(any());
    }

    @Test
    void refresh_forADisabledUser_revokesTheSession_andIsRejected() {
        user.setStatus(UserStatus.DISABLED);
        when(refreshTokens.rotate("old")).thenReturn(new RefreshTokenService.Rotated("u1", "f1", "new"));
        when(users.findById("u1")).thenReturn(Optional.of(user));

        ApiException e = assertThrows(ApiException.class, () -> service.refresh("old"));

        assertEquals(ErrorCode.INVALID_REFRESH_TOKEN, e.getCode());

        verify(refreshTokens).revokeFamily("f1");
        verify(jwt, never()).createAccessToken(any());
    }

    @Test
    void logout_revokesTheSession() {
        service.logout("some-token");
        verify(refreshTokens).revoke("some-token");
    }

    @Test
    void logout_withoutACookie_doesNotFail() {
        assertDoesNotThrow(() -> service.logout(null));
    }
}
