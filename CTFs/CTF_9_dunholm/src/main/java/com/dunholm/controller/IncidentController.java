package com.dunholm.controller;

import com.dunholm.config.JwtConfig;
import com.dunholm.repository.UserFlagRepository;
import com.dunholm.service.JwtService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class IncidentController {

    private final JwtService jwtService;
    private final JwtConfig jwtConfig;
    private final UserFlagRepository userFlagRepository;

    public IncidentController(JwtService jwtService, JwtConfig jwtConfig, UserFlagRepository userFlagRepository) {
        this.jwtService = jwtService;
        this.jwtConfig = jwtConfig;
        this.userFlagRepository = userFlagRepository;
    }

    @GetMapping("/incident-report")
    public String incidentReport(HttpServletRequest request, Model model) {
        HttpSession session = request.getSession(false);
        String staffUser = session == null ? null : (String) session.getAttribute("STAFF_USER");
        if (!"amir.patel".equals(staffUser)) {
            return "redirect:/staff-login";
        }

        String playerUsername = readPlayerFromJwtCookie(request);
        String flag6 = null;
        if (playerUsername != null) {
            flag6 = userFlagRepository.findByUsernameAndFlagIndex(playerUsername, 6)
                .map(uf -> uf.getFlagValue())
                .orElse(null);
        }

        model.addAttribute("staffUser", staffUser);
        model.addAttribute("playerUsername", playerUsername);
        model.addAttribute("flag6", flag6);
        return "incident-report";
    }

    private String readPlayerFromJwtCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (!jwtConfig.getCookieName().equals(c.getName())) continue;
            try {
                Claims claims = jwtService.verifyToken(c.getValue());
                return claims.getSubject();
            } catch (Exception e) {
                return null;
            }
        }
        return null;
    }
}
