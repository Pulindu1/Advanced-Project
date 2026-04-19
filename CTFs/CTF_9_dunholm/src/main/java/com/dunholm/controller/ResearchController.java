package com.dunholm.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/research")
public class ResearchController {

    @GetMapping("/search")
    public Map<String, Object> search(@RequestParam(name = "q", required = false, defaultValue = "") String q) {
        return Map.of("found", false, "count", 0);
    }
}
