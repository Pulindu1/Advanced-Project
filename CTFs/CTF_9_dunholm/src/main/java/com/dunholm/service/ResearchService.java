package com.dunholm.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ResearchService {

    private static final Logger log = LoggerFactory.getLogger(ResearchService.class);

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional(readOnly = true)
    public SearchResult search(String query) {
        String sql = "SELECT COUNT(*) FROM trials WHERE title ILIKE '%" + query + "%'";
        log.info("executing: {}", sql);
        Object raw = entityManager.createNativeQuery(sql).getSingleResult();
        long count = ((Number) raw).longValue();
        return new SearchResult(count > 0, count);
    }

    public record SearchResult(boolean found, long count) {}
}
