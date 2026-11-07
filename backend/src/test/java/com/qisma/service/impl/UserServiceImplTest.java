package com.qisma.service.impl;

import com.qisma.dto.request.ChangePasswordRequest;
import com.qisma.dto.request.UpdateProfileRequest;
import com.qisma.dto.response.UserResponse;
import com.qisma.enums.Language;
import com.qisma.enums.UserStatus;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.mapper.UserMapper;
import com.qisma.model.User;
import com.qisma.repository.UserRepository;
import com.qisma.security.RefreshTokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;

import static org.mockito.Mockito.*;

class UserServiceImplTest {

    private UserRepository users;
    private RefreshTokenService refreshTokens;
    private PasswordEncoder encoder;
    private UserServiceImpl service;
    private User user;

    @BeforeEach
    void setUp() {
        users = mock(UserRepository.class);
        refreshTokens = mock(RefreshTokenService.class);
        encoder = new BCryptPasswordEncoder();
        service = new UserServiceImpl(users, new UserMapper(), encoder, refreshTokens);

        user = new User();
        user.setId("u1");
        user.setUsername("youssef");
        user.setFullName("Youssef");
        user.setEmail("youssef@test.com");
        user.setPasswordHash(encoder.encode("Passw0rdOK"));

        when(users.findById("u1")).thenReturn(Optional.of(user));
        when(users.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private ApiException failChange(String current, String next, String confirm) {
        return assertThrows(ApiException.class,
                () -> service.changePassword("u1", new ChangePasswordRequest(current, next, confirm)));
    }


    @Test
    void updateProfile_trimsTheNameAndChangesLanguage() {
        UserResponse r = service.updateProfile("u1", new UpdateProfileRequest("  Youssef E.  ", Language.AR));

        assertEquals("Youssef E.", r.fullName());
        assertEquals(Language.AR, r.preferredLanguage());
        assertEquals("youssef@test.com", r.email());
    }

    @Test
    void changePassword_savesNewHash_andRevokesEverySession() {
        service.changePassword("u1", new ChangePasswordRequest("Passw0rdOK", "NewPassw0rd", "NewPassw0rd"));

        assertTrue(encoder.matches("NewPassw0rd", user.getPasswordHash()));
        assertFalse(encoder.matches("Passw0rdOK", user.getPasswordHash()));
        verify(users).save(user);
        verify(refreshTokens).revokeAllForUser("u1");
    }

    @Test
    void changePassword_wrongCurrentPassword_isRejected_andChangesNothing() {
        String oldHash = user.getPasswordHash();

        assertEquals(ErrorCode.CURRENT_PASSWORD_INCORRECT,
                failChange("WrongPass1", "NewPassw0rd", "NewPassw0rd").getCode());

        assertEquals(oldHash, user.getPasswordHash());
        verify(users, never()).save(any());
        verify(refreshTokens, never()).revokeAllForUser(any());
    }


    @Test
    void changePassword_mismatchedConfirmation_isRejected() {
        assertEquals(ErrorCode.VALIDATION_FAILED,
                failChange("Passw0rdOK", "NewPassw0rd", "Different1").getCode());
        verify(users, never()).save(any());
    }

    @Test
    void changePassword_sameAsCurrent_isRejected() {
        assertEquals(ErrorCode.VALIDATION_FAILED,
                failChange("Passw0rdOK", "Passw0rdOK", "Passw0rdOK").getCode());
        verify(refreshTokens, never()).revokeAllForUser(any());
    }

    @Test
    void inactiveUser_cannotUseTheseOperations() {
        user.setStatus(UserStatus.DISABLED);

        assertEquals(ErrorCode.UNAUTHORIZED, assertThrows(ApiException.class,
                () -> service.updateProfile("u1", new UpdateProfileRequest("X", Language.FR))).getCode());
        assertEquals(ErrorCode.UNAUTHORIZED,
                failChange("Passw0rdOK", "NewPassw0rd", "NewPassw0rd").getCode());
    }
}
