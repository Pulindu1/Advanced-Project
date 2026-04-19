package com.dunholm.controller;

import com.dunholm.repository.DocumentRepository;
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
        model.addAttribute("documents", documentRepository.findAllByOrderByIdAsc());
        return "documents";
    }
}
