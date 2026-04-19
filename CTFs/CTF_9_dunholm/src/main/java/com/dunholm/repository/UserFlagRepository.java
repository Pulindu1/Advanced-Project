package com.dunholm.repository;

import com.dunholm.model.UserFlag;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserFlagRepository extends JpaRepository<UserFlag, Long> {
    Optional<UserFlag> findByUsernameAndFlagIndex(String username, Integer flagIndex);
}
