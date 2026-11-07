package com.qisma.service.impl;

import com.qisma.dto.request.ChangePasswordRequest;
import com.qisma.dto.request.UpdateProfileRequest;
import com.qisma.dto.response.UserResponse;
import com.qisma.enums.UserStatus;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.mapper.UserMapper;
import com.qisma.model.User;
import com.qisma.repository.UserRepository;
import com.qisma.security.RefreshTokenService;
import com.qisma.service.UserService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class UserServiceImpl implements UserService {

    private final UserRepository users;
    private final UserMapper mapper;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenService refreshTokens;

    public UserServiceImpl(UserRepository users, UserMapper mapper,
                           PasswordEncoder passwordEncoder, RefreshTokenService refreshTokens) {
        this.users = users;
        this.mapper = mapper;
        this.passwordEncoder = passwordEncoder;
        this.refreshTokens = refreshTokens;
    }

    @Override
    public UserResponse getActiveUser(String userId) {
        return mapper.toResponse(loadActive(userId));
    }

    @Override
    public UserResponse updateProfile(String userId, UpdateProfileRequest request) {
        User user = loadActive(userId);
        user.setFullName(request.fullName().trim());
        user.setPreferredLanguage(request.preferredLanguage());
        return mapper.toResponse(users.save(user));
    }

    @Override
    public void changePassword(String userId, ChangePasswordRequest request) {
        if (!request.newPassword().equals(request.confirmNewPassword())) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Passwords do not match");
        }

        User user = loadActive(userId);

        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new ApiException(ErrorCode.CURRENT_PASSWORD_INCORRECT, "Current password is incorrect");
        }
        if (passwordEncoder.matches(request.newPassword(), user.getPasswordHash())) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED,
                    "New password must be different from the current one");
        }

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        users.save(user);
        refreshTokens.revokeAllForUser(userId);
    }

    private User loadActive(String userId) {
        return users.findById(userId)
                .filter(u -> u.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED, "Account is not available"));
    }
}
