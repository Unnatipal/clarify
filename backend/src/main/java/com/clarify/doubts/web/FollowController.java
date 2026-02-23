package com.clarify.doubts.web;

import com.clarify.doubts.model.Follow;
import com.clarify.doubts.repo.FollowRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/follow")
public class FollowController {
  private final FollowRepository follows;
  public FollowController(FollowRepository follows) { this.follows = follows; }
  @PostMapping("/{username}")
  public ResponseEntity<?> follow(@PathVariable String username, Principal principal) {
    String me = principal.getName();
    if (me.equals(username)) return ResponseEntity.badRequest().body("Cannot follow yourself");
    if (follows.findByFollowerAndFollowing(me, username).isPresent()) return ResponseEntity.ok().build();
    Follow f = new Follow();
    f.setFollower(me); f.setFollowing(username);
    follows.save(f);
    return ResponseEntity.ok().build();
  }
  @DeleteMapping("/{username}")
  public ResponseEntity<?> unfollow(@PathVariable String username, Principal principal) {
    var opt = follows.findByFollowerAndFollowing(principal.getName(), username);
    opt.ifPresent(follows::delete);
    return ResponseEntity.ok().build();
  }
  @GetMapping("/list")
  public List<String> list(Principal principal) {
    return follows.findByFollower(principal.getName()).stream().map(Follow::getFollowing).collect(Collectors.toList());
  }
}
