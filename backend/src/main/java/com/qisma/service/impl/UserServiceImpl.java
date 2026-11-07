package com.qisma.service.impl;

import com.qisma.dto.response.UserResponse;
import com.qisma.enums.UserStatus;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.mapper.UserMapper;
import com.qisma.repository.UserRepository;
import com.qisma.service.UserService;
import org.springframework.stereotype.Service;

@Service
public class UserServiceImpl implements UserService {

    private final UserRepository users;
    private final UserMapper mapper;

    public UserServiceImpl(UserRepository users, UserMapper mapper) {
        this.users = users;
        this.mapper = mapper;
    }

    @Override
    public UserResponse getActiveUser(String userId) {
        return users.findById(userId)
                .filter(u -> u.getStatus() == UserStatus.ACTIVE)
                .map(mapper::toResponse)
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED, "Account is not available"));
    }
}
