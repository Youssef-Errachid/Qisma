package com.qisma.service;

import com.qisma.dto.response.LoginResponse;

/** What a successful login/refresh produces: a JSON body plus the refresh token for the cookie. */
public record AuthSession(LoginResponse response, String refreshToken) {
}
