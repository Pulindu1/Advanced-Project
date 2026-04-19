package com.dunholm.controller;

import com.dunholm.model.User;
import com.dunholm.service.AuthService;
import com.dunholm.service.LoginRateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.Optional;

@Controller
public class AuthController {

    private final AuthService authService;
    private final LoginRateLimiter rateLimiter;

    public AuthController(AuthService authService, LoginRateLimiter rateLimiter) {
        this.authService = authService;
        this.rateLimiter = rateLimiter;
    }

    @GetMapping("/")
    public String root() {
        return "redirect:/login";
    }

    @GetMapping("/login")
    public String loginPage(@RequestParam(value = "error", required = false) String error,
                            @RequestParam(value = "logout", required = false) String logout,
                            Model model) {
        model.addAttribute("productName", "TrialVault");
        model.addAttribute("version", "3.4.1");
        model.addAttribute("error", error);
        model.addAttribute("logout", logout);
        return "login";
    }

    @PostMapping("/login")
    public String login(@RequestParam("username") String username,
                        @RequestParam("password") String password,
                        HttpServletRequest request,
                        HttpServletResponse response) {
        String ip = request.getRemoteAddr();
        if (!rateLimiter.tryConsume("login:" + ip)) {
            return "redirect:/login?error=rate";
        }
        String rawBody = "{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}";
        Optional<User> maybe = authService.authenticate(username, password, rawBody);
        if (maybe.isEmpty()) {
            return "redirect:/login?error=1";
        }
        authService.issueSessionCookie(maybe.get(), response);
        return "redirect:/dashboard";
    }

    @PostMapping("/logout")
    public String logout(HttpServletResponse response, HttpServletRequest request) {
        authService.clearSessionCookie(response);
        HttpSession s = request.getSession(false);
        if (s != null) s.invalidate();
        return "redirect:/login?logout=1";
    }

    @GetMapping("/staff-login")
    public String staffLoginPage(@RequestParam(value = "error", required = false) String error,
                                  Model model) {
        model.addAttribute("error", error);
        return "staff-login";
    }

    @PostMapping("/staff-login")
    public String staffLogin(@RequestParam("username") String username,
                             @RequestParam("password") String password,
                             HttpServletRequest request) {
        String ip = request.getRemoteAddr();
        if (!rateLimiter.tryConsume("stafflogin:" + ip)) {
            return "redirect:/staff-login?error=rate";
        }
        String rawBody = "{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}";
        Optional<User> maybe = authService.authenticate(username, password, rawBody);
        if (maybe.isEmpty() || !"amir.patel".equals(username)) {
            return "redirect:/staff-login?error=1";
        }
        HttpSession s = request.getSession(true);
        s.setAttribute("STAFF_USER", username);
        return "redirect:/incident-report";
    }
}
