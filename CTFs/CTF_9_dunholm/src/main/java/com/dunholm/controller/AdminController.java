package com.dunholm.controller;

import com.dunholm.repository.UserFlagRepository;
import com.dunholm.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
class AdminApiController {

    private final UserRepository userRepository;
    private final UserFlagRepository userFlagRepository;

    AdminApiController(UserRepository userRepository, UserFlagRepository userFlagRepository) {
        this.userRepository = userRepository;
        this.userFlagRepository = userFlagRepository;
    }

    @GetMapping("/dashboard")
    public ResponseEntity<?> dashboard() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || !a.isAuthenticated() || "anonymousUser".equals(a.getName())) {
            return ResponseEntity.status(401).body(Map.of("error", "authentication required"));
        }
        boolean isAdmin = a.getAuthorities().stream()
            .anyMatch(g -> "ROLE_CTO_ADMIN".equals(g.getAuthority()) || "ROLE_ADMIN".equals(g.getAuthority()));
        if (!isAdmin) {
            return ResponseEntity.status(403).body(Map.of("error", "administrator role required"));
        }

        String viewer = a.getName();
        String flag3 = userFlagRepository.findByUsernameAndFlagIndex(viewer, 3)
            .map(uf -> uf.getFlagValue())
            .orElse("flag3 not found for " + viewer);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("viewer", viewer);
        body.put("flag", flag3);
        body.put("stats", Map.of(
            "active_trials", 5,
            "documents_total", 7,
            "secrets_rotated_30d", 1,
            "failed_logins_24h", 0
        ));

        List<Map<String, Object>> users = new ArrayList<>();
        userRepository.findAll().forEach(u -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("username", u.getUsername());
            row.put("display_name", u.getDisplayName());
            row.put("role", u.getRole());
            row.put("active", u.isActive());
            users.add(row);
        });
        body.put("users", users);

        body.put("rachel_memo", List.of(
            "Rachel Osei, Security Lead, pinned memo (excerpt):",
            "The search endpoint at /api/research/search still concatenates the user query",
            "into a SQL string and calls entityManager.createNativeQuery. I have asked the",
            "team twice to move this to a parameterised repository method. The encrypted",
            "releases in /data/vault/ are wrapped with RSA-512; we flagged the short key at",
            "the last architecture review but the rotation was deferred for the Q2 release.",
            "Both items need to be closed before the next external audit."
        ));

        body.put("recent_sql_queries", List.of(
            Map.of(
                "at", "2024-09-26T07:45:02Z",
                "actor", "amir.patel",
                "query", "SELECT * FROM secrets WHERE secret_key = 'encryption_key_part2'"
            ),
            Map.of(
                "at", "2024-09-26T07:45:17Z",
                "actor", "amir.patel",
                "query", "SELECT COUNT(*) FROM trials WHERE title ILIKE '%neuroinflammation%'"
            ),
            Map.of(
                "at", "2024-09-27T08:02:51Z",
                "actor", "helen.cross",
                "query", "SELECT secret_key FROM secrets WHERE owner_username = 'helen.cross'"
            )
        ));

        body.put("amir_note", List.of(
            "Amir Patel, CTO, handover note (sticky):",
            "The research search endpoint /api/research/search is fine for the handover.",
            "It is read-only and the team uses it daily. Do not disable during the audit",
            "or the enrolment dashboards lose their status counters."
        ));

        body.put("tools", List.of(
            Map.of("name", "user directory", "state", "ok"),
            Map.of("name", "key rotation", "state", "deferred"),
            Map.of("name", "audit export", "state", "ok")
        ));

        return ResponseEntity.ok(body);
    }
}

@Controller
class AdminPageController {

    @GetMapping("/admin")
    public String admin(Model model) {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        model.addAttribute("username", a == null ? null : a.getName());
        return "admin";
    }
}
