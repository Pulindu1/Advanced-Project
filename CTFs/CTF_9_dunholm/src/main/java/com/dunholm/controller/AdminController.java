package com.dunholm.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
class AdminApiController {

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard() {
        return Map.of("status", "placeholder");
    }
}

@Controller
class AdminPageController {

    @GetMapping("/admin")
    public String admin(Model model) {
        return "admin";
    }
}
