package com.clarify.doubts.repo;

import com.clarify.doubts.model.Follow;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface FollowRepository extends JpaRepository<Follow, Long> {
  List<Follow> findByFollower(String follower);
  Optional<Follow> findByFollowerAndFollowing(String follower, String following);
}
