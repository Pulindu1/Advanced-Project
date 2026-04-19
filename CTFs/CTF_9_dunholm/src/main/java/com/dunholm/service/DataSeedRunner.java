package com.dunholm.service;

import com.dunholm.model.Secret;
import com.dunholm.model.User;
import com.dunholm.model.UserFlag;
import com.dunholm.repository.SecretRepository;
import com.dunholm.repository.UserFlagRepository;
import com.dunholm.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.util.Iterator;
import java.util.Map;

@Component
@Order(10)
public class DataSeedRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeedRunner.class);

    private final UserRepository userRepository;
    private final UserFlagRepository userFlagRepository;
    private final SecretRepository secretRepository;
    private final PasswordEncoder passwordEncoder;
    private final VaultEncryptionService vaultEncryptionService;
    private final LogfileSeedService logfileSeedService;
    private final ObjectMapper mapper = new ObjectMapper();

    @Value("${app.seed.flags-path:/app/config/flags.json}")
    private String flagsPath;

    @Value("${app.seed.users-path:/app/config/users.json}")
    private String usersPath;

    @Value("${app.config.dunholm-handoff-a:DR_KEY_PART1_PLACEHOLDER}")
    private String drApiKeyPart1;

    @Value("${file.storage.base-path}")
    private String uploadsBase;

    @Value("${file.vault-path:/data/vault}")
    private String vaultPath;

    @Value("${app.config.properties-location:/app/config/application.properties}")
    private String propertiesLocation;

    public DataSeedRunner(UserRepository userRepository,
                          UserFlagRepository userFlagRepository,
                          SecretRepository secretRepository,
                          PasswordEncoder passwordEncoder,
                          VaultEncryptionService vaultEncryptionService,
                          LogfileSeedService logfileSeedService) {
        this.userRepository = userRepository;
        this.userFlagRepository = userFlagRepository;
        this.secretRepository = secretRepository;
        this.passwordEncoder = passwordEncoder;
        this.vaultEncryptionService = vaultEncryptionService;
        this.logfileSeedService = logfileSeedService;
    }

    @Override
    public void run(String... args) throws Exception {
        JsonNode users = readJson(usersPath);
        JsonNode flags = readJson(flagsPath);

        if (users == null) {
            log.warn("users.json not found at {}; skipping player seed", usersPath);
        } else {
            seedUsers(users);
        }

        if (flags != null) {
            seedUserFlags(flags);
            seedFlag4Secrets(flags);
        } else {
            log.warn("flags.json not found at {}; per-user flags not seeded", flagsPath);
        }

        seedSharedPart2();
        substituteConfigFilePlaceholders(flags);
        vaultEncryptionService.generatePerUserVaults(flags);
        logfileSeedService.seedLogfile();
    }

    private JsonNode readJson(String location) throws IOException {
        Path p = Path.of(location);
        if (!Files.exists(p)) {
            return null;
        }
        return mapper.readTree(Files.readAllBytes(p));
    }

    private void seedUsers(JsonNode usersNode) {
        Iterator<Map.Entry<String, JsonNode>> it = usersNode.fields();
        while (it.hasNext()) {
            Map.Entry<String, JsonNode> e = it.next();
            String username = e.getKey();
            JsonNode u = e.getValue();
            String rawPassword = u.path("password").asText("");
            String role = u.path("role").asText("researcher");
            String display = u.path("display_name").asText(username);
            boolean active = u.path("active").asBoolean(true);

            User user = userRepository.findByUsername(username).orElseGet(User::new);
            user.setUsername(username);
            user.setDisplayName(display);
            user.setRole(role);
            user.setActive(active);
            if (!"SYSTEM_INTERNAL".equals(rawPassword) && !rawPassword.isEmpty()) {
                user.setPasswordHash(passwordEncoder.encode(rawPassword));
            } else if (user.getPasswordHash() == null || user.getPasswordHash().isBlank() || user.getPasswordHash().startsWith("$2a$10$unused")) {
                user.setPasswordHash(passwordEncoder.encode(
                    "disabled_" + username + "_" + System.nanoTime()));
            }
            userRepository.save(user);
        }
        log.info("Seeded {} users", userRepository.count());
    }

    private void seedUserFlags(JsonNode flagsNode) {
        Iterator<Map.Entry<String, JsonNode>> it = flagsNode.fields();
        int count = 0;
        while (it.hasNext()) {
            Map.Entry<String, JsonNode> e = it.next();
            String username = e.getKey();
            JsonNode f = e.getValue();
            for (int i = 1; i <= 6; i++) {
                String key = "flag" + i;
                if (!f.has(key)) continue;
                String value = f.path(key).asText();
                UserFlag uf = userFlagRepository.findByUsernameAndFlagIndex(username, i).orElseGet(UserFlag::new);
                uf.setUsername(username);
                uf.setFlagIndex(i);
                uf.setFlagValue(value);
                userFlagRepository.save(uf);
                count++;
            }
        }
        log.info("Seeded {} user_flags rows", count);
    }

    private void seedFlag4Secrets(JsonNode flagsNode) {
        Iterator<Map.Entry<String, JsonNode>> it = flagsNode.fields();
        int count = 0;
        while (it.hasNext()) {
            Map.Entry<String, JsonNode> e = it.next();
            String username = e.getKey();
            String flag4 = e.getValue().path("flag4").asText(null);
            if (flag4 == null) continue;
            String key = "flag4_" + username;
            Secret s = secretRepository.findAll().stream()
                .filter(x -> key.equals(x.getSecretKey()))
                .findFirst()
                .orElseGet(Secret::new);
            s.setSecretKey(key);
            s.setSecretValue(flag4);
            s.setOwnerUsername(username);
            s.setDescription("Handoff material keyed to auditor username");
            secretRepository.save(s);
            count++;
        }
        log.info("Seeded {} per-user flag4 secrets", count);
    }

    private void seedSharedPart2() {
        Secret existing = secretRepository.findAll().stream()
            .filter(s -> "encryption_key_part2".equals(s.getSecretKey()))
            .findFirst()
            .orElseGet(Secret::new);
        if (existing.getId() == null || "SEED_PART2_PLACEHOLDER".equals(existing.getSecretValue())) {
            existing.setSecretKey("encryption_key_part2");
            existing.setSecretValue("dr-part2-7f1a9c5e3b8d4a6f");
            existing.setOwnerUsername(null);
            existing.setDescription("Second half of the document AES key. Rotated with each encrypted release.");
            secretRepository.save(existing);
            log.info("Seeded shared encryption_key_part2");
        }
    }

    private void substituteConfigFilePlaceholders(JsonNode flagsNode) {
        if (flagsNode == null) return;
        Path cfg = Path.of(propertiesLocation);
        if (!Files.exists(cfg)) {
            log.warn("Config file not found at {}; skipping Flag 2 substitution", propertiesLocation);
            return;
        }
        try {
            String contents = Files.readString(cfg, StandardCharsets.UTF_8);
            if (contents.contains("{{PLAYER_FLAG2}}")) {
                log.info("Leaving {{PLAYER_FLAG2}} placeholder in config file for per-request substitution");
            }
        } catch (IOException e) {
            log.warn("Failed to read config file: {}", e.getMessage());
        }
    }

    public String derivedAesKeyHex() {
        Secret part2 = secretRepository.findAll().stream()
            .filter(s -> "encryption_key_part2".equals(s.getSecretKey()))
            .findFirst().orElse(null);
        if (part2 == null) return null;
        String composite = drApiKeyPart1 + part2.getSecretValue();
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(composite.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            return null;
        }
    }
}
