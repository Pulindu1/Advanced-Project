package com.dunholm.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class IncidentController {

    @GetMapping("/incident-report")
    public String incidentReport(Model model) {
        return "incident-report";
    }
}
