package com.qisma.service;

import com.qisma.dto.request.LoginRequest;

public interface SessionService {

    AuthSession login(LoginRequest request);

    AuthSession refresh(String refreshToken);

    void logout(String refreshToken);
}
