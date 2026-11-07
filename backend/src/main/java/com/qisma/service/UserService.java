package com.qisma.service;

import com.qisma.dto.response.UserResponse;

public interface UserService {

    UserResponse getActiveUser(String userId);
}
