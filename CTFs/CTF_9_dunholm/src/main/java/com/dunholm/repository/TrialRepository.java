package com.dunholm.repository;

import com.dunholm.model.Trial;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TrialRepository extends JpaRepository<Trial, Long> {
}
