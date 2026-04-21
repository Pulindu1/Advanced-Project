package com.dunholm.service;

import com.dunholm.config.JwtConfig;
import com.dunholm.model.User;
import com.dunholm.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

// Contract tests for the authentication boundary. These exercise
// AuthService.authenticate() with mocked collaborators to assert that
// unknown/inactive/wrong-password cases all resolve to Optional.empty()
// without a differential (no user enumeration signal).
class AuthServiceTest {

    private UserRepository userRepository;
    private PasswordEncoder passwordEncoder;
    private JwtService jwtService;
    private JwtConfig jwtConfig;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        userRepository = Mockito.mock(UserRepository.class);
        passwordEncoder = Mockito.mock(PasswordEncoder.class);
        jwtService = Mockito.mock(JwtService.class);
        jwtConfig = Mockito.mock(JwtConfig.class);
        authService = new AuthService(userRepository, passwordEncoder, jwtService, jwtConfig);
    }

    @Test
    void unknown_username_returns_empty() {
        when(userRepository.findByUsername("nobody")).thenReturn(Optional.empty());
        assertTrue(authService.authenticate("nobody", "anything", "{}").isEmpty());
    }

    @Test
    void inactive_user_returns_empty_even_if_password_would_match() {
        User u = new User();
        u.setUsername("disabled.user");
        u.setPasswordHash("$2a$10$hashstub");
        u.setRole("researcher");
        u.setActive(false);
        when(userRepository.findByUsername("disabled.user")).thenReturn(Optional.of(u));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);
        assertTrue(authService.authenticate("disabled.user", "whatever", "{}").isEmpty());
    }

    @Test
    void wrong_password_returns_empty() {
        User u = new User();
        u.setUsername("abcd12");
        u.setPasswordHash("$2a$10$hashstub");
        u.setRole("researcher");
        u.setActive(true);
        when(userRepository.findByUsername("abcd12")).thenReturn(Optional.of(u));
        when(passwordEncoder.matches("wrong", "$2a$10$hashstub")).thenReturn(false);
        assertTrue(authService.authenticate("abcd12", "wrong", "{}").isEmpty());
    }
}
