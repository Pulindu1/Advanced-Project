package com.dunholm.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/files")
public class FileController {

    @GetMapping("/download")
    public ResponseEntity<String> download(@RequestParam("name") String name) {
        return ResponseEntity.ok("download placeholder: " + name);
    }
}
