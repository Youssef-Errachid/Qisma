package com.qisma.service;

import com.qisma.dto.request.LoginRequest;
import com.qisma.dto.request.RegisterRequest;
import com.qisma.dto.response.LoginResponse;
import com.qisma.dto.response.UserResponse;

public interface AuthService {

    UserResponse register(RegisterRequest request);

    LoginResponse login(LoginRequest request);
}
