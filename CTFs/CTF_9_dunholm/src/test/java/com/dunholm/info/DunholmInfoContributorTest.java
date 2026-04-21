package com.dunholm.info;

import com.dunholm.model.UserFlag;
import com.dunholm.repository.UserFlagRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.boot.actuate.info.Info;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

// Contract tests for the actuator /info build block. The contributor
// returns the current user's flag1 when the SecurityContext is populated
// and an explanatory prompt otherwise. These tests lock that branching
// without requiring a Spring Boot context.
class DunholmInfoContributorTest {

    private UserFlagRepository userFlagRepository;
    private DunholmInfoContributor contributor;

    @BeforeEach
    void setUp() {
        userFlagRepository = Mockito.mock(UserFlagRepository.class);
        contributor = new DunholmInfoContributor(userFlagRepository);
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> buildDetails() {
        Info.Builder b = new Info.Builder();
        contributor.contribute(b);
        return (Map<String, Object>) b.build().getDetails().get("build");
    }

    @Test
    void unauthenticated_context_returns_auth_prompt() {
        Map<String, Object> build = buildDetails();
        assertEquals("TrialVault", build.get("product"));
        assertEquals("authenticate to see your per-user build flag", build.get("flag"));
    }

    @Test
    void authenticated_user_without_flag_returns_auth_prompt() {
        Authentication auth = new UsernamePasswordAuthenticationToken(
            "abcd12", "n/a", List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);
        when(userFlagRepository.findByUsernameAndFlagIndex("abcd12", 1)).thenReturn(Optional.empty());

        Map<String, Object> build = buildDetails();
        assertEquals("authenticate to see your per-user build flag", build.get("flag"));
    }

    @Test
    void authenticated_user_with_flag_returns_flag_value() {
        Authentication auth = new UsernamePasswordAuthenticationToken(
            "abcd12", "n/a", List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);

        UserFlag uf = new UserFlag();
        uf.setUsername("abcd12");
        uf.setFlagIndex(1);
        uf.setFlagValue("dunholm{test-flag-1}");
        when(userFlagRepository.findByUsernameAndFlagIndex("abcd12", 1)).thenReturn(Optional.of(uf));

        Map<String, Object> build = buildDetails();
        assertEquals("dunholm{test-flag-1}", build.get("flag"));
    }
}
