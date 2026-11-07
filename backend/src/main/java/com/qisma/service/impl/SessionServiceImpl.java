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
import com.qisma.security.RefreshTokenService;
import com.qisma.service.AuthService;
import com.qisma.service.AuthSession;
import com.qisma.service.SessionService;
import org.springframework.stereotype.Service;

@Service
public class SessionServiceImpl implements SessionService {

    private final AuthService authService;
    private final RefreshTokenService refreshTokens;
    private final UserRepository users;
    private final JwtService jwtService;
    private final UserMapper mapper;

    public SessionServiceImpl(AuthService authService, RefreshTokenService refreshTokens,
                              UserRepository users, JwtService jwtService, UserMapper mapper) {
        this.authService = authService;
        this.refreshTokens = refreshTokens;
        this.users = users;
        this.jwtService = jwtService;
        this.mapper = mapper;
    }

    @Override
    public AuthSession login(LoginRequest request) {
        LoginResponse response = authService.login(request);
        return new AuthSession(response, refreshTokens.issue(response.user().id()));
    }

    @Override
    public AuthSession refresh(String refreshToken) {
        RefreshTokenService.Rotated rotated = refreshTokens.rotate(refreshToken);

        User user = users.findById(rotated.userId())
                .filter(u -> u.getStatus() == UserStatus.ACTIVE)
                .orElse(null);
        if (user == null) {
            refreshTokens.revokeFamily(rotated.familyId());
            throw new ApiException(ErrorCode.INVALID_REFRESH_TOKEN, "Invalid or expired refresh token");
        }

        LoginResponse response = new LoginResponse(jwtService.createAccessToken(user), "Bearer",
                jwtService.accessTtlSeconds(), mapper.toResponse(user));
        return new AuthSession(response, rotated.refreshToken());
    }

    @Override
    public void logout(String refreshToken) {
        refreshTokens.revoke(refreshToken);
    }
}
