package com.clarify.doubts.repo;

import com.clarify.doubts.model.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {
  Optional<AppUser> findByUsername(String username);
  Optional<AppUser> findByUsernameIgnoreCase(String username);
  boolean existsByUsername(String username);
  boolean existsByUsernameIgnoreCase(String username);
}
