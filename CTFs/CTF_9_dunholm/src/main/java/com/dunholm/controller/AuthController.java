package com.dunholm.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.ui.Model;

@Controller
public class AuthController {

    @GetMapping("/login")
    public String login(Model model) {
        model.addAttribute("productName", "TrialVault");
        model.addAttribute("version", "3.4.1");
        return "login";
    }

    @GetMapping("/")
    public String root() {
        return "redirect:/login";
    }
}
