package com.qisma.controller;

import com.qisma.dto.request.ChangePasswordRequest;
import com.qisma.dto.request.UpdateProfileRequest;
import com.qisma.dto.response.UserResponse;
import com.qisma.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The identity always comes from the verified token, never from the request. */
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal Jwt jwt) {
        return userService.getActiveUser(jwt.getSubject());
    }

    @PutMapping("/me")
    public UserResponse updateMe(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody UpdateProfileRequest request) {
        return userService.updateProfile(jwt.getSubject(), request);
    }

    @PutMapping("/me/password")
    public ResponseEntity<Void> changePassword(@AuthenticationPrincipal Jwt jwt,
                                               @Valid @RequestBody ChangePasswordRequest request) {
        userService.changePassword(jwt.getSubject(), request);
        return ResponseEntity.noContent().build();
    }
}
