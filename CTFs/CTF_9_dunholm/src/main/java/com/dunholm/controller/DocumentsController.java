package com.dunholm.controller;

import com.dunholm.repository.DocumentRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class DocumentsController {

    private final DocumentRepository documentRepository;

    public DocumentsController(DocumentRepository documentRepository) {
        this.documentRepository = documentRepository;
    }

    @GetMapping("/documents")
    public String documents(Model model) {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        model.addAttribute("username", a == null ? null : a.getName());
        model.addAttribute("documents", documentRepository.findAllByOrderByIdAsc());
        return "documents";
    }
}
