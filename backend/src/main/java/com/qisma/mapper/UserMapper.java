package com.qisma.mapper;

import com.qisma.dto.response.UserResponse;
import com.qisma.model.User;
import org.springframework.stereotype.Component;


@Component
public class UserMapper {

    public UserResponse toResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getFullName(),
                user.getEmail(),
                user.getProfileImage(),
                user.getPreferredLanguage(),
                user.getCreatedAt());
    }
}
