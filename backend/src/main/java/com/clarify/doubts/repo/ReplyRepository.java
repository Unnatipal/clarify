package com.clarify.doubts.repo;

import com.clarify.doubts.model.Reply;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ReplyRepository extends JpaRepository<Reply, Long> {
  long countByDoubtId(Long doubtId);
  List<Reply> findByDoubtId(Long doubtId);
  Optional<Reply> findByIdAndDoubtId(Long id, Long doubtId);
}
