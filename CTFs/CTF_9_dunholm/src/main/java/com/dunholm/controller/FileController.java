package com.dunholm.controller;

import com.dunholm.repository.UserFlagRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

@RestController
@RequestMapping("/api/files")
public class FileController {

    @Value("${file.storage.base-path}")
    private String basePath;

    private final UserFlagRepository userFlagRepository;

    public FileController(UserFlagRepository userFlagRepository) {
        this.userFlagRepository = userFlagRepository;
    }

    @GetMapping("/download")
    public ResponseEntity<byte[]> download(@RequestParam("name") String name) {
        String sanitised = name.replace("../", "");
        Path base = Path.of(basePath);
        Path target = base.resolve(sanitised).normalize();
        if (!Files.exists(target) || Files.isDirectory(target)) {
            return ResponseEntity.status(404)
                .contentType(MediaType.TEXT_PLAIN)
                .body(("File not found: " + sanitised).getBytes(StandardCharsets.UTF_8));
        }
        try {
            byte[] bytes = Files.readAllBytes(target);
            String text;
            if (looksTextual(target)) {
                text = new String(bytes, StandardCharsets.UTF_8);
                text = substitutePlayerPlaceholders(text);
                bytes = text.getBytes(StandardCharsets.UTF_8);
            }
            return ResponseEntity.ok()
                .contentType(MediaType.TEXT_PLAIN)
                .body(bytes);
        } catch (IOException e) {
            return ResponseEntity.status(500)
                .contentType(MediaType.TEXT_PLAIN)
                .body(("Read error: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        }
    }

    private static boolean looksTextual(Path p) {
        String n = p.getFileName().toString().toLowerCase();
        return n.endsWith(".txt") || n.endsWith(".md") || n.endsWith(".properties")
            || n.endsWith(".pem") || n.endsWith(".log") || n.endsWith(".json")
            || n.endsWith(".conf") || n.endsWith(".yaml") || n.endsWith(".yml");
    }

    private String substitutePlayerPlaceholders(String text) {
        if (!text.contains("{{PLAYER_FLAG")) return text;
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || !a.isAuthenticated() || "anonymousUser".equals(a.getName())) {
            return text;
        }
        String username = a.getName();
        for (int i = 1; i <= 6; i++) {
            String token = "{{PLAYER_FLAG" + i + "}}";
            if (text.contains(token)) {
                String value = userFlagRepository.findByUsernameAndFlagIndex(username, i)
                    .map(uf -> uf.getFlagValue())
                    .orElse(token);
                text = text.replace(token, value);
            }
        }
        return text;
    }
}
