package com.qisma.service;

import com.qisma.dto.request.ChangePasswordRequest;
import com.qisma.dto.request.UpdateProfileRequest;
import com.qisma.dto.response.UserResponse;

public interface UserService {

    UserResponse getActiveUser(String userId);

    UserResponse updateProfile(String userId, UpdateProfileRequest request);

    void changePassword(String userId, ChangePasswordRequest request);
}
