package com.dunholm.integration;

import com.dunholm.model.Trial;
import com.dunholm.repository.TrialRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Multi-route integration: a trial inserted through the JPA repository
// is observable via two GET /api/research/search calls -- one matching
// query and one non-matching -- proving real H2 persistence drives the
// route response, not a stub.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ResearchSearchPersistenceIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private TrialRepository trialRepository;

    @BeforeEach
    void setUp() {
        trialRepository.deleteAll();

        Trial t = new Trial();
        t.setCode("DUN-IT-001");
        t.setTitle("Integration Test Neuroinflammation Study");
        t.setPhase("II");
        t.setStatus("ACTIVE");
        t.setSummary("seeded for integration test");
        t.setLeadInvestigator("Dr Test");
        t.setCreatedAt(Instant.now());
        trialRepository.save(t);
    }

    @Test
    void search_finds_seeded_trial_then_misses_unrelated_query() throws Exception {
        mvc.perform(get("/api/research/search").param("q", "Neuroinflammation"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.found").value(true))
            .andExpect(jsonPath("$.count").value(1));

        mvc.perform(get("/api/research/search").param("q", "absolutely-not-present-zzz"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.found").value(false))
            .andExpect(jsonPath("$.count").value(0));
    }
}
