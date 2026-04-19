package com.dunholm.controller;

import com.dunholm.service.ResearchService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/research")
public class ResearchController {

    private final ResearchService researchService;

    public ResearchController(ResearchService researchService) {
        this.researchService = researchService;
    }

    @GetMapping("/search")
    public Map<String, Object> search(@RequestParam(name = "q", required = false, defaultValue = "") String q) {
        ResearchService.SearchResult r;
        try {
            r = researchService.search(q);
        } catch (Exception e) {
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("found", false);
            err.put("count", 0);
            err.put("error", "query failed");
            return err;
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("found", r.found());
        body.put("count", r.count());
        return body;
    }
}
