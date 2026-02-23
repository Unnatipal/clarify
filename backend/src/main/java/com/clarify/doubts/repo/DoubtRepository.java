package com.clarify.doubts.repo;

import com.clarify.doubts.model.Doubt;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DoubtRepository extends JpaRepository<Doubt, Long> {
}
