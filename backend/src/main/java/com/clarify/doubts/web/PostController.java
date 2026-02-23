package com.clarify.doubts.web;

import com.clarify.doubts.model.Post;
import com.clarify.doubts.repo.PostRepository;
import com.clarify.doubts.repo.FollowRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.nio.file.*;
import java.security.Principal;
import java.util.*;

@RestController
@RequestMapping("/api/posts")
public class PostController {
  private final PostRepository posts;
  private final FollowRepository follows;
  public PostController(PostRepository posts, FollowRepository follows) {
    this.posts = posts; this.follows = follows;
  }
  @PostMapping
  public ResponseEntity<?> create(@RequestParam(required=false) MultipartFile image,
                                  @RequestParam String content,
                                  Principal principal) throws Exception {
    String author = principal.getName();
    String url = null;
    if (image != null && !image.isEmpty()) {
      Files.createDirectories(Paths.get("uploads"));
      String name = UUID.randomUUID().toString() + "-" + Paths.get(image.getOriginalFilename()).getFileName();
      Path dest = Paths.get("uploads").resolve(name);
      Files.write(dest, image.getBytes());
      url = "/uploads/" + name;
    }
    Post p = new Post();
    p.setAuthorUsername(author);
    p.setContent(content);
    p.setImageUrl(url);
    return ResponseEntity.ok(posts.save(p));
  }
  @GetMapping
  public List<Post> feed(@RequestParam(defaultValue = "false") boolean following, Principal principal) {
    if (following && principal != null) {
      var fl = follows.findByFollower(principal.getName());
      List<String> authors = new ArrayList<>();
      for (var f : fl) authors.add(f.getFollowing());
      authors.add(principal.getName());
      if (authors.isEmpty()) return posts.findAllByOrderByCreatedAtDesc();
      return posts.findAllByAuthorUsernameInOrderByCreatedAtDesc(authors);
    }
    return posts.findAllByOrderByCreatedAtDesc();
  }
}
