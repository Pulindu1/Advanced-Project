package com.dunholm.service;

import com.dunholm.config.JwtConfig;
import com.dunholm.model.User;
import com.dunholm.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final JwtConfig jwtConfig;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       JwtConfig jwtConfig) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.jwtConfig = jwtConfig;
    }

    public Optional<User> authenticate(String username, String password, String rawBodyForDebug) {
        log.info("login attempt for {}", username);
        log.debug("request body: {}", rawBodyForDebug);
        Optional<User> maybe = userRepository.findByUsername(username);
        if (maybe.isEmpty()) {
            return Optional.empty();
        }
        User u = maybe.get();
        if (!u.isActive()) {
            return Optional.empty();
        }
        if (!passwordEncoder.matches(password, u.getPasswordHash())) {
            return Optional.empty();
        }
        log.info("login success: {}", username);
        return Optional.of(u);
    }

    public void issueSessionCookie(User user, HttpServletResponse response) {
        String token = jwtService.issue(user.getUsername(), Map.of(
            "username", user.getUsername(),
            "role", user.getRole()
        ));
        Cookie c = new Cookie(jwtConfig.getCookieName(), token);
        c.setHttpOnly(true);
        c.setPath("/");
        c.setMaxAge((int) (jwtConfig.getExpiryMinutes() * 60L));
        response.addCookie(c);
    }

    public void clearSessionCookie(HttpServletResponse response) {
        Cookie c = new Cookie(jwtConfig.getCookieName(), "");
        c.setHttpOnly(true);
        c.setPath("/");
        c.setMaxAge(0);
        response.addCookie(c);
    }
}
