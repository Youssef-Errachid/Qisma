package com.qisma.service.impl;

import com.qisma.dto.request.RegisterRequest;

import com.qisma.dto.response.UserResponse;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.mapper.UserMapper;
import com.qisma.model.User;
import com.qisma.repository.UserRepository;
import com.qisma.service.AuthService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
public class AuthServiceImpl implements AuthService {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final UserMapper mapper;

    public AuthServiceImpl(UserRepository users, PasswordEncoder passwordEncoder, UserMapper mapper) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.mapper = mapper;
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
}
