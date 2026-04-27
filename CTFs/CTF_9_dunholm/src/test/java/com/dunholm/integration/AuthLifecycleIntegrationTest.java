package com.dunholm.integration;

import com.dunholm.model.User;
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Multi-route auth flow: login -> dashboard -> logout -> dashboard
// proves the issued JWT cookie reaches the next request and that
// invalidating the cookie removes access on a subsequent route call.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class AuthLifecycleIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
        User u = new User();
        u.setUsername("abcd12");
        u.setDisplayName("Alice Researcher");
        u.setEmail("alice@dunholm.test");
        u.setPasswordHash(passwordEncoder.encode("correct-pw"));
        u.setRole("researcher");
        u.setActive(true);
        userRepository.save(u);
    }

    @Test
    void bad_login_keeps_dashboard_unreachable_then_good_login_unlocks_it_then_logout_locks_it_again() throws Exception {
        mvc.perform(post("/login").param("username", "abcd12").param("password", "wrong"))
            .andExpect(status().is3xxRedirection())
            .andExpect(redirectedUrl("/login?error=1"));

        mvc.perform(get("/dashboard"))
            .andExpect(status().isForbidden());

        MvcResult login = mvc.perform(post("/login")
                .param("username", "abcd12")
                .param("password", "correct-pw"))
            .andExpect(status().is3xxRedirection())
            .andExpect(redirectedUrl("/dashboard"))
            .andReturn();
        Cookie session = login.getResponse().getCookie("tv_session");
        assertNotNull(session, "login should set tv_session cookie");

        mvc.perform(get("/dashboard").cookie(session))
            .andExpect(status().isOk());

        MvcResult logout = mvc.perform(post("/logout").cookie(session))
            .andExpect(status().is3xxRedirection())
            .andExpect(redirectedUrl("/login?logout=1"))
            .andReturn();
        Cookie cleared = logout.getResponse().getCookie("tv_session");
        assertNotNull(cleared);
        assertEquals(0, cleared.getMaxAge(), "logout must expire the cookie");

        mvc.perform(get("/dashboard").cookie(cleared))
            .andExpect(status().isForbidden());
    }
}
