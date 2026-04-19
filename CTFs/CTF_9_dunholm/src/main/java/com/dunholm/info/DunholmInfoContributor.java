package com.dunholm.info;

import org.springframework.boot.actuate.info.Info;
import org.springframework.boot.actuate.info.InfoContributor;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class DunholmInfoContributor implements InfoContributor {

    @Override
    public void contribute(Info.Builder builder) {
        Map<String, Object> build = new LinkedHashMap<>();
        build.put("product", "TrialVault");
        build.put("version", "3.4.1");
        build.put("flag", "authenticate to see your per-user build flag");
        builder.withDetail("build", build);
    }
}
