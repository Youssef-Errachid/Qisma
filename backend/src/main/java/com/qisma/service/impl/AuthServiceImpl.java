package com.qisma.service.impl;

import com.qisma.dto.request.LoginRequest;
import com.qisma.dto.request.RegisterRequest;
import com.qisma.dto.response.LoginResponse;
import com.qisma.dto.response.UserResponse;
import com.qisma.enums.UserStatus;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.mapper.UserMapper;
import com.qisma.model.User;
import com.qisma.repository.UserRepository;
import com.qisma.security.JwtService;
import com.qisma.service.AuthService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;

@Service
public class AuthServiceImpl implements AuthService {

    static final int MAX_FAILED_LOGINS = 5;
    static final Duration LOCK_DURATION = Duration.ofMinutes(15);

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final UserMapper mapper;
    private final JwtService jwtService;
    private final Clock clock;
    /** Used to spend the same time on unknown emails as on wrong passwords. */
    private final String dummyHash;

    public AuthServiceImpl(UserRepository users, PasswordEncoder passwordEncoder, UserMapper mapper,
                           JwtService jwtService, Clock clock) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.mapper = mapper;
        this.jwtService = jwtService;
        this.clock = clock;
        this.dummyHash = passwordEncoder.encode("qisma-dummy-password");
    }

    @Override
    public UserResponse register(RegisterRequest request) {
        if (!request.password().equals(request.confirmPassword())) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Passwords do not match");
        }

        String email = request.email().trim().toLowerCase(Locale.ROOT);
        String username = request.username().trim();

        if (users.existsByEmail(email)) {
            throw new ApiException(ErrorCode.EMAIL_ALREADY_USED, "Email is already registered");
        }
        if (users.existsByUsernameIgnoreCase(username)) {
            throw new ApiException(ErrorCode.USERNAME_ALREADY_USED, "Username is already taken");
        }

        User user = new User();
        user.setUsername(username);
        user.setFullName(request.fullName().trim());
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));

        try {
            return mapper.toResponse(users.save(user));
        } catch (DuplicateKeyException e) {
            // two concurrent registrations: the unique index is the real guard
            throw new ApiException(ErrorCode.EMAIL_ALREADY_USED, "Email or username is already in use");
        }
    }

    @Override
    public LoginResponse login(LoginRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        User user = users.findByEmail(email).orElse(null);

        if (user == null) {
            passwordEncoder.matches(request.password(), dummyHash);
            throw invalidCredentials();
        }
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw invalidCredentials();
        }

        Instant now = clock.instant();
        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(now)) {
            throw new ApiException(ErrorCode.ACCOUNT_LOCKED, "Too many failed attempts, try again later");
        }

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            int failures = user.getFailedLoginCount() + 1;
            if (failures >= MAX_FAILED_LOGINS) {
                user.setLockedUntil(now.plus(LOCK_DURATION));
                failures = 0;
            }
            user.setFailedLoginCount(failures);
            users.save(user);
            throw invalidCredentials();
        }

        user.setFailedLoginCount(0);
        user.setLockedUntil(null);
        user.setLastLoginAt(now);
        users.save(user);

        return new LoginResponse(jwtService.createAccessToken(user), "Bearer",
                jwtService.accessTtlSeconds(), mapper.toResponse(user));
    }

    private static ApiException invalidCredentials() {
        return new ApiException(ErrorCode.INVALID_CREDENTIALS, "Invalid email or password");
    }
}
