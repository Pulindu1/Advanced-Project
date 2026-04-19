package com.dunholm.info;

import com.dunholm.repository.UserFlagRepository;
import org.springframework.boot.actuate.info.Info;
import org.springframework.boot.actuate.info.InfoContributor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class DunholmInfoContributor implements InfoContributor {

    private static final String UNAUTH_PROMPT =
        "authenticate to see your per-user build flag";

    private final UserFlagRepository userFlagRepository;

    public DunholmInfoContributor(UserFlagRepository userFlagRepository) {
        this.userFlagRepository = userFlagRepository;
    }

    @Override
    public void contribute(Info.Builder builder) {
        Map<String, Object> build = new LinkedHashMap<>();
        build.put("product", "TrialVault");
        build.put("version", "3.4.1");
        build.put("flag", resolveFlagForCurrentUser());
        builder.withDetail("build", build);
    }

    private String resolveFlagForCurrentUser() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || !a.isAuthenticated() || "anonymousUser".equals(a.getName())) {
            return UNAUTH_PROMPT;
        }
        return userFlagRepository.findByUsernameAndFlagIndex(a.getName(), 1)
            .map(uf -> uf.getFlagValue())
            .orElse(UNAUTH_PROMPT);
    }
}
