package com.clarify.doubts.web;

import com.clarify.doubts.model.Doubt;
import com.clarify.doubts.model.DoubtDifficulty;
import com.clarify.doubts.model.DoubtStatus;
import com.clarify.doubts.model.Reply;
import com.clarify.doubts.repo.DoubtRepository;
import com.clarify.doubts.repo.ReplyRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

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
  public ResponseEntity<?> create(HttpServletRequest request, Authentication authentication) throws IOException {
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
    String actor = authName(authentication);
    if (authorName == null && actor != null) authorName = actor;

    String difficultyRaw = firstNonBlank(input, "difficulty", "level");
    DoubtDifficulty difficulty = parseDifficulty(difficultyRaw);
    if (difficulty == null) difficulty = DoubtDifficulty.MEDIUM;

    int bountyPoints = parseNonNegativeInt(firstNonBlank(input, "bountyPoints", "bounty", "points"), 0);
    List<String> topics = parseTopics(firstNonBlank(input, "topics", "topic", "tags", "labels"));

    if (title == null || description == null || authorName == null) {
      return ResponseEntity.badRequest().body("title, description and authorName are required");
    }

    Doubt body = new Doubt();
    body.setTitle(title);
    body.setDescription(description);
    body.setAuthorName(authorName);
    body.setAuthorCredential(actor == null ? authorName : actor);
    body.setDifficulty(difficulty);
    body.setBountyPoints(bountyPoints);
    body.setTopics(topics);
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
      body.setAccepted(false);
      body.setBountyAwardedPoints(0);
      replies.save(body);
      return ResponseEntity.ok(doubts.findById(id).get());
    }).orElseGet(() -> ResponseEntity.notFound().build());
  }

  @PatchMapping("/{doubtId}/replies/{replyId}/accept")
  public ResponseEntity<?> acceptReply(@PathVariable Long doubtId, @PathVariable Long replyId, Authentication authentication) {
    return doubts.findById(doubtId).map(doubt -> {
      String actor = authName(authentication);
      if (!isDoubtOwner(doubt, actor)) {
        return ResponseEntity.status(403).body("Only doubt owner can accept an answer");
      }

      Reply acceptedReply = replies.findByIdAndDoubtId(replyId, doubtId).orElse(null);
      if (acceptedReply == null) return ResponseEntity.notFound().build();

      int bounty = safeNonNegative(doubt.getBountyPoints());
      List<Reply> doubtReplies = replies.findByDoubtId(doubtId);
      for (Reply reply : doubtReplies) {
        boolean isAccepted = reply.getId() != null && reply.getId().equals(replyId);
        reply.setAccepted(isAccepted);
        reply.setBountyAwardedPoints(isAccepted ? bounty : 0);
      }
      replies.saveAll(doubtReplies);

      doubt.setStatus(DoubtStatus.SOLVED);
      doubts.save(doubt);
      return ResponseEntity.ok(doubts.findById(doubtId).orElse(doubt));
    }).orElseGet(() -> ResponseEntity.notFound().build());
  }

  @PatchMapping("/{id}/bounty")
  public ResponseEntity<?> addBounty(@PathVariable Long id, @RequestParam Integer points, Authentication authentication) {
    if (points == null || points <= 0) {
      return ResponseEntity.badRequest().body("points must be greater than 0");
    }
    return doubts.findById(id).map(doubt -> {
      String actor = authName(authentication);
      if (!isDoubtOwner(doubt, actor)) {
        return ResponseEntity.status(403).body("Only doubt owner can add bounty points");
      }

      int next = safeNonNegative(doubt.getBountyPoints()) + points;
      doubt.setBountyPoints(next);
      doubts.save(doubt);

      // If an answer has already been accepted, keep bounty award in sync.
      List<Reply> doubtReplies = replies.findByDoubtId(id);
      for (Reply reply : doubtReplies) {
        if (reply.isAccepted()) {
          reply.setBountyAwardedPoints(next);
        }
      }
      replies.saveAll(doubtReplies);

      return ResponseEntity.ok(doubts.findById(id).orElse(doubt));
    }).orElseGet(() -> ResponseEntity.notFound().build());
  }

  private static String authName(Authentication authentication) {
    if (authentication == null || authentication.getName() == null) return null;
    String name = authentication.getName().trim();
    return name.isEmpty() ? null : name;
  }

  private static int safeNonNegative(Integer value) {
    return value == null ? 0 : Math.max(value, 0);
  }

  private static DoubtDifficulty parseDifficulty(String raw) {
    if (raw == null || raw.isBlank()) return null;
    String normalized = raw.trim().toUpperCase();
    try {
      return DoubtDifficulty.valueOf(normalized);
    } catch (IllegalArgumentException ignored) {
      return null;
    }
  }

  private static int parseNonNegativeInt(String raw, int defaultValue) {
    if (raw == null || raw.isBlank()) return defaultValue;
    try {
      return Math.max(Integer.parseInt(raw.trim()), 0);
    } catch (NumberFormatException ignored) {
      return defaultValue;
    }
  }

  private static List<String> parseTopics(String raw) {
    if (raw == null || raw.isBlank()) return new ArrayList<>();
    String cleaned = raw
      .trim()
      .replace("[", "")
      .replace("]", "")
      .replace("\"", "")
      .replace("'", "");

    String[] chunks = cleaned.split(",");
    Set<String> unique = new LinkedHashSet<>();
    for (String chunk : chunks) {
      String topic = chunk == null ? "" : chunk.trim();
      if (!topic.isEmpty()) unique.add(topic);
      if (unique.size() >= 6) break;
    }
    return new ArrayList<>(unique);
  }

  private static String normalizeIdentity(String value) {
    return value == null ? "" : value.trim().toLowerCase();
  }

  private static String usernamePart(String value) {
    String normalized = normalizeIdentity(value);
    int at = normalized.indexOf('@');
    if (at <= 0) return normalized;
    return normalized.substring(0, at);
  }

  private static boolean isDoubtOwner(Doubt doubt, String actor) {
    String current = normalizeIdentity(actor);
    if (current.isEmpty()) return false;

    String authorCredential = normalizeIdentity(doubt.getAuthorCredential());
    if (!authorCredential.isEmpty()) {
      if (authorCredential.equals(current)) return true;
      return usernamePart(authorCredential).equals(usernamePart(current));
    }

    String authorName = normalizeIdentity(doubt.getAuthorName());
    if (authorName.isEmpty()) return false;
    return authorName.equals(current) || authorName.equals(usernamePart(current));
  }

  private static String firstNonBlank(Map<String, String> input, String... keys) {
    for (String key : keys) {
      String value = input.get(key);
      if (value != null && !value.trim().isEmpty()) return value.trim();
    }
    return null;
  }
}
