package com.dunholm.integration;

import com.dunholm.model.User;
import com.dunholm.model.UserFlag;
import com.dunholm.repository.UserFlagRepository;
import com.dunholm.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Multi-route flow that mirrors the Flag-3 admin path. POST /login
// issues a JWT cookie carrying role=cto_admin; the next request
// (GET /api/admin/dashboard) reads that cookie, the JwtAuthFilter
// upgrades the SecurityContext, and the handler joins user_flags by
// the cookie's subject. A non-admin login on the second test reaches
// the same route and is rejected with 403.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class AdminFlagFlowIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private UserRepository userRepository;
    @Autowired private UserFlagRepository userFlagRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    @BeforeEach
    void setUp() {
        userFlagRepository.deleteAll();
        userRepository.deleteAll();
    }

    private void seedUser(String username, String role, String password) {
        User u = new User();
        u.setUsername(username);
        u.setDisplayName(username);
        u.setEmail(username + "@dunholm.test");
        u.setPasswordHash(passwordEncoder.encode(password));
        u.setRole(role);
        u.setActive(true);
        userRepository.save(u);
    }

    private Cookie loginAndGetCookie(String username, String password) throws Exception {
        MvcResult login = mvc.perform(post("/login")
                .param("username", username)
                .param("password", password))
            .andExpect(status().is3xxRedirection())
            .andReturn();
        Cookie session = login.getResponse().getCookie("tv_session");
        assertNotNull(session, "expected tv_session cookie after login");
        return session;
    }

    @Test
    void admin_login_then_admin_dashboard_returns_seeded_user_flag3() throws Exception {
        seedUser("abcd12", "cto_admin", "admin-pw");
        UserFlag f = new UserFlag();
        f.setUsername("abcd12");
        f.setFlagIndex(3);
        f.setFlagValue("durham{int-flag3-abcd12}");
        userFlagRepository.save(f);

        Cookie session = loginAndGetCookie("abcd12", "admin-pw");

        mvc.perform(get("/api/admin/dashboard").cookie(session))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.viewer").value("abcd12"))
            .andExpect(jsonPath("$.flag").value("durham{int-flag3-abcd12}"));
    }

    @Test
    void researcher_login_then_admin_dashboard_is_403_with_no_flag_leaked() throws Exception {
        seedUser("efgh34", "researcher", "user-pw");
        UserFlag f = new UserFlag();
        f.setUsername("efgh34");
        f.setFlagIndex(3);
        f.setFlagValue("durham{should-never-leak}");
        userFlagRepository.save(f);

        Cookie session = loginAndGetCookie("efgh34", "user-pw");

        mvc.perform(get("/api/admin/dashboard").cookie(session))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("administrator role required"));
    }
}
