package com.qisma.service;

import com.qisma.dto.request.RegisterRequest;
import com.qisma.dto.response.UserResponse;

public interface AuthService {

    UserResponse register(RegisterRequest request);
}
