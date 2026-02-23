package com.clarify.doubts.web;

import com.clarify.doubts.model.Doubt;
import com.clarify.doubts.model.DoubtStatus;
import com.clarify.doubts.model.Reply;
import com.clarify.doubts.repo.DoubtRepository;
import com.clarify.doubts.repo.ReplyRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/doubts")
public class DoubtController {
  private final DoubtRepository doubts;
  private final ReplyRepository replies;
  private final ObjectMapper objectMapper;

  public DoubtController(DoubtRepository doubts, ReplyRepository replies, ObjectMapper objectMapper) {
    this.doubts = doubts;
    this.replies = replies;
    this.objectMapper = objectMapper;
  }

  @GetMapping
  public List<Doubt> list() {
    return doubts.findAll();
  }

  @PostMapping
  public ResponseEntity<?> create(HttpServletRequest request) throws IOException {
    Map<String, String> input = new LinkedHashMap<>();
    request.getParameterMap().forEach((k, v) -> {
      if (v != null && v.length > 0) input.put(k, v[0]);
    });

    if (input.isEmpty()) {
      String raw = request.getReader().lines().reduce("", (a, b) -> a + b);
      if (raw != null && !raw.isBlank()) {
        String trimmed = raw.trim();
        if (trimmed.startsWith("{")) {
          try {
            @SuppressWarnings("unchecked")
            Map<String, Object> json = objectMapper.readValue(trimmed, Map.class);
            for (Map.Entry<String, Object> entry : json.entrySet()) {
              if (entry.getValue() != null) input.put(entry.getKey(), String.valueOf(entry.getValue()));
            }
          } catch (Exception ignored) {
            // Ignore invalid JSON and continue with validation below.
          }
        }
      }
    }

    String title = firstNonBlank(input, "title", "doubtTitle", "question", "subject");
    String description = firstNonBlank(input, "description", "message", "content", "body", "doubt");
    String authorName = firstNonBlank(input, "authorName", "author", "username", "userName", "name");

    if (title == null || description == null || authorName == null) {
      return ResponseEntity.badRequest().body("title, description and authorName are required");
    }

    Doubt body = new Doubt();
    body.setTitle(title);
    body.setDescription(description);
    body.setAuthorName(authorName);
    Doubt saved = doubts.save(body);
    return ResponseEntity.created(URI.create("/api/doubts/" + saved.getId())).body(saved);
  }

  @GetMapping("/{id}")
  public ResponseEntity<Doubt> get(@PathVariable Long id) {
    return doubts.findById(id).map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
  }

  @PatchMapping("/{id}/status")
  public ResponseEntity<Doubt> updateStatus(@PathVariable Long id, @RequestParam DoubtStatus status) {
    return doubts.findById(id).map(d -> {
      d.setStatus(status);
      return ResponseEntity.ok(doubts.save(d));
    }).orElseGet(() -> ResponseEntity.notFound().build());
  }

  @PostMapping("/{id}/replies")
  public ResponseEntity<Doubt> addReply(@PathVariable Long id, @Valid @RequestBody Reply body) {
    return doubts.findById(id).map(d -> {
      body.setDoubt(d);
      replies.save(body);
      return ResponseEntity.ok(doubts.findById(id).get());
    }).orElseGet(() -> ResponseEntity.notFound().build());
  }

  private static String firstNonBlank(Map<String, String> input, String... keys) {
    for (String key : keys) {
      String value = input.get(key);
      if (value != null && !value.trim().isEmpty()) return value.trim();
    }
    return null;
  }
}
