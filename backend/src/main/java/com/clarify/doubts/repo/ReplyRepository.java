package com.clarify.doubts.repo;

import com.clarify.doubts.model.Reply;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReplyRepository extends JpaRepository<Reply, Long> {
  long countByDoubtId(Long doubtId);
}
