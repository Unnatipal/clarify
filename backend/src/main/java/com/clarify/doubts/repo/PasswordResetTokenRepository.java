package com.clarify.doubts.repo;

import com.clarify.doubts.model.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {
  Optional<PasswordResetToken> findTopByEmailAndTokenOrderByIdDesc(String email, String token);
}
