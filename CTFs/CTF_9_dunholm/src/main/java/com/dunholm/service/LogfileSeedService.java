package com.dunholm.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;

@Service
public class LogfileSeedService {

    private static final Logger log = LoggerFactory.getLogger(LogfileSeedService.class);

    @Value("${logging.file.name:/app/logs/trialvault.log}")
    private String logfileLocation;

    // Spring Boot's RollingFileAppender rotates trialvault.log at midnight,
    // archiving the seeded block into the day's .gz. Re-prepend on a tick so
    // the Flag-6 password line survives rotation; seed is idempotent via the
    // "Seeded audit history" marker check below.
    @Scheduled(fixedDelay = 60_000L, initialDelay = 60_000L)
    public void scheduledReseed() {
        seedLogfile();
    }

    public void seedLogfile() {
        Path p = Path.of(logfileLocation);
        try {
            if (p.getParent() != null) Files.createDirectories(p.getParent());
            if (Files.exists(p) && Files.size(p) > 0) {
                // Prepend the seeded history so live logs trail below.
                String existing = Files.readString(p, StandardCharsets.UTF_8);
                if (existing.contains("Seeded audit history, read-only")) {
                    return;
                }
                String combined = buildSeedBlock() + existing;
                Files.writeString(p, combined, StandardCharsets.UTF_8,
                    StandardOpenOption.TRUNCATE_EXISTING, StandardOpenOption.WRITE);
            } else {
                Files.writeString(p, buildSeedBlock(), StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE, StandardOpenOption.WRITE);
            }
            log.info("Seeded application log at {}", p);
        } catch (Exception e) {
            log.warn("Could not seed log file at {}: {}", p, e.getMessage());
        }
    }

    private String buildSeedBlock() {
        return String.join("\n",
            "### Seeded audit history, read-only. Do not edit. Shipped with release 3.4.1.",
            "2024-09-20 08:14:02 INFO  [main] com.dunholm.DunholmApplication - Starting DunholmApplication v3.4.1 using Java 17.0.18",
            "2024-09-20 08:14:05 INFO  [main] com.dunholm.service.AuthService - Auth subsystem initialised; debug request body logging is enabled for handover diagnostics",
            "2024-09-20 08:17:41 INFO  [http-nio-8080-exec-2] com.dunholm.service.AuthService - login attempt for sophie.chen",
            "2024-09-20 08:17:41 DEBUG [http-nio-8080-exec-2] com.dunholm.service.AuthService - request body: {\"username\":\"sophie.chen\",\"password\":\"<redacted by router>\"}",
            "2024-09-20 08:17:41 INFO  [http-nio-8080-exec-2] com.dunholm.service.AuthService - login success: sophie.chen",
            "2024-09-20 09:02:18 INFO  [http-nio-8080-exec-4] com.dunholm.service.AuthService - login attempt for rachel.osei",
            "2024-09-20 09:02:18 DEBUG [http-nio-8080-exec-4] com.dunholm.service.AuthService - request body: {\"username\":\"rachel.osei\",\"password\":\"<redacted by router>\"}",
            "2024-09-20 09:02:18 INFO  [http-nio-8080-exec-4] com.dunholm.service.AuthService - login success: rachel.osei",
            "2024-09-20 10:31:47 WARN  [http-nio-8080-exec-6] com.dunholm.service.ResearchService - raw SQL query ran for 1.8s against trials; marked for review",
            "2024-09-20 11:15:05 INFO  [http-nio-8080-exec-3] com.dunholm.service.AuthService - login attempt for james.whitfield",
            "2024-09-20 11:15:05 DEBUG [http-nio-8080-exec-3] com.dunholm.service.AuthService - request body: {\"username\":\"james.whitfield\",\"password\":\"<redacted by router>\"}",
            "2024-09-20 11:15:05 INFO  [http-nio-8080-exec-3] com.dunholm.service.AuthService - login success: james.whitfield",
            "2024-09-21 07:58:12 INFO  [http-nio-8080-exec-7] com.dunholm.service.AuthService - login attempt for amir.patel",
            "2024-09-21 07:58:12 DEBUG [http-nio-8080-exec-7] com.dunholm.service.AuthService - request body: {\"username\":\"amir.patel\",\"password\":\"DunholmCTO2024!\"}",
            "2024-09-21 07:58:12 INFO  [http-nio-8080-exec-7] com.dunholm.service.AuthService - login success: amir.patel",
            "2024-09-21 07:58:40 INFO  [http-nio-8080-exec-7] com.dunholm.controller.AdminController - admin dashboard viewed by amir.patel",
            "2024-09-21 07:59:14 INFO  [http-nio-8080-exec-7] com.dunholm.service.ResearchService - executing: SELECT * FROM secrets WHERE key = 'encryption_key_part2'",
            "2024-09-21 08:04:32 WARN  [http-nio-8080-exec-9] com.dunholm.service.FileController - download requested: /data/vault/classified-trial-results-2024-q2.enc (denied by policy)",
            "2024-09-23 13:11:55 INFO  [http-nio-8080-exec-8] com.dunholm.service.AuthService - login attempt for helen.cross",
            "2024-09-23 13:11:55 DEBUG [http-nio-8080-exec-8] com.dunholm.service.AuthService - request body: {\"username\":\"helen.cross\",\"password\":\"<redacted by router>\"}",
            "2024-09-23 13:11:55 INFO  [http-nio-8080-exec-8] com.dunholm.service.AuthService - login success: helen.cross",
            "2024-09-24 09:02:12 WARN  [scheduler-1] com.dunholm.service.SchedulerService - nightly integrity check reported 1 file outside expected hash set",
            "2024-09-24 09:02:12 WARN  [scheduler-1] com.dunholm.service.SchedulerService - offending path: /data/vault/classified-trial-results-2024-q2.enc",
            "2024-09-25 16:42:03 INFO  [http-nio-8080-exec-5] com.dunholm.service.AuthService - login attempt for rachel.osei",
            "2024-09-25 16:42:03 DEBUG [http-nio-8080-exec-5] com.dunholm.service.AuthService - request body: {\"username\":\"rachel.osei\",\"password\":\"<redacted by router>\"}",
            "2024-09-25 16:42:03 INFO  [http-nio-8080-exec-5] com.dunholm.service.AuthService - login success: rachel.osei",
            "2024-09-25 16:58:29 INFO  [http-nio-8080-exec-5] com.dunholm.controller.IncidentController - incident review draft accessed by rachel.osei",
            "2024-09-26 07:44:02 INFO  [http-nio-8080-exec-6] com.dunholm.service.AuthService - login attempt for amir.patel",
            "2024-09-26 07:44:02 DEBUG [http-nio-8080-exec-6] com.dunholm.service.AuthService - request body: {\"username\":\"amir.patel\",\"password\":\"DunholmCTO2024!\"}",
            "2024-09-26 07:44:02 INFO  [http-nio-8080-exec-6] com.dunholm.service.AuthService - login success: amir.patel",
            "2024-09-26 07:44:28 INFO  [http-nio-8080-exec-6] com.dunholm.controller.AdminController - admin dashboard viewed by amir.patel",
            "2024-09-26 07:45:02 INFO  [http-nio-8080-exec-6] com.dunholm.service.ResearchService - executing: SELECT * FROM secrets WHERE key = 'encryption_key_part2'",
            "2024-09-26 07:45:17 INFO  [http-nio-8080-exec-6] com.dunholm.service.FileController - file accessed: /data/vault/classified-trial-results-2024-q2.enc",
            "2024-09-27 08:01:51 INFO  [http-nio-8080-exec-4] com.dunholm.service.AuthService - login attempt for helen.cross",
            "2024-09-27 08:01:51 DEBUG [http-nio-8080-exec-4] com.dunholm.service.AuthService - request body: {\"username\":\"helen.cross\",\"password\":\"<redacted by router>\"}",
            "2024-09-27 08:01:51 INFO  [http-nio-8080-exec-4] com.dunholm.service.AuthService - login success: helen.cross",
            "2024-09-27 08:03:17 INFO  [http-nio-8080-exec-4] com.dunholm.controller.IncidentController - incident review board summary authored by helen.cross",
            "2024-09-27 17:42:20 WARN  [scheduler-1] com.dunholm.service.SchedulerService - handover reminder: debug request body logging is still active in production and should be reduced to INFO before end of sprint",
            "### end of seeded block, live log tail follows",
            ""
        ) + "\n";
    }
}
