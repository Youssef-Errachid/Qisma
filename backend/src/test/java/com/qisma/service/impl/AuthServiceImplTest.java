package com.qisma.service.impl;

import com.qisma.dto.request.RegisterRequest;
import com.qisma.dto.response.UserResponse;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.mapper.UserMapper;
import com.qisma.model.User;
import com.qisma.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AuthServiceImplTest {

    private UserRepository users;
    private PasswordEncoder encoder;
    private AuthServiceImpl service;

    @BeforeEach
    void setUp() {

        users = mock(UserRepository.class);
        encoder = new BCryptPasswordEncoder();
        service = new AuthServiceImpl(users, encoder, new UserMapper());
        when(users.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private static RegisterRequest request(String email, String password, String confirm) {
        return new RegisterRequest("youssef", "  Youssef Test ", email, password, confirm);
    }

    @Test
    void register_normalizesEmail_hashesPassword_andNeverExposesHash() {
        UserResponse response = service.register(request("  Youssef@Test.COM ", "Passw0rdOK", "Passw0rdOK"));

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(users).save(saved.capture());

        assertEquals("youssef@test.com", saved.getValue().getEmail());
        assertEquals("Youssef Test", saved.getValue().getFullName());
        assertNotEquals("Passw0rdOK", saved.getValue().getPasswordHash());
        assertTrue(encoder.matches("Passw0rdOK", saved.getValue().getPasswordHash()));
        assertEquals("youssef@test.com", response.email());
    }

    @Test
    void register_rejectsMismatchedPasswords_withoutTouchingTheDatabase() {
        ApiException e = assertThrows(ApiException.class,
                () -> service.register(request("a@b.com", "Passw0rdOK", "Different1")));
        assertEquals(ErrorCode.VALIDATION_FAILED, e.getCode());
        verify(users, never()).save(any());
    }


    @Test
    void register_rejectsExistingEmail() {
        when(users.existsByEmail("a@b.com")).thenReturn(true);
        ApiException e = assertThrows(ApiException.class,
                () -> service.register(request("A@B.com", "Passw0rdOK", "Passw0rdOK")));
        assertEquals(ErrorCode.EMAIL_ALREADY_USED, e.getCode());
        verify(users, never()).save(any());
    }

    @Test
    void register_rejectsExistingUsername() {
        when(users.existsByUsernameIgnoreCase("youssef")).thenReturn(true);
        ApiException e = assertThrows(ApiException.class,
                () -> service.register(request("a@b.com", "Passw0rdOK", "Passw0rdOK")));
        assertEquals(ErrorCode.USERNAME_ALREADY_USED, e.getCode());
    }

    @Test
    void register_mapsRaceConditionDuplicateKeyToConflict() {
        when(users.save(any(User.class))).thenThrow(new DuplicateKeyException("dup"));
        ApiException e = assertThrows(ApiException.class,
                () -> service.register(request("a@b.com", "Passw0rdOK", "Passw0rdOK")));
        assertEquals(ErrorCode.EMAIL_ALREADY_USED, e.getCode());
    }
}
