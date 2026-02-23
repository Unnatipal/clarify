package com.clarify.doubts.web;

import java.net.URI;
import java.security.Principal;
import java.time.Instant;
import java.util.Map;
import java.util.Random;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.clarify.doubts.model.AppUser;
import com.clarify.doubts.model.PasswordResetToken;
import com.clarify.doubts.repo.AppUserRepository;
import com.clarify.doubts.repo.PasswordResetTokenRepository;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final AppUserRepository users;
  private final PasswordResetTokenRepository tokens;
  public AuthController(AppUserRepository users, PasswordResetTokenRepository tokens) { this.users = users; this.tokens = tokens; }

  public record SignupRequest(
    @NotBlank @Size(min = 3, max = 50) String username,
    @NotBlank @Size(min = 4, max = 100) String password
  ) {}

  @PostMapping("/signup")
  public ResponseEntity<?> signup(@Valid @RequestBody SignupRequest req) {
    String username = req.username().trim();
    if (users.existsByUsernameIgnoreCase(username)) {
      return ResponseEntity.status(409).body("Username already exists");
    }
    AppUser newUser = new AppUser();
    newUser.setUsername(username);
    newUser.setPassword(req.password());
    newUser.setRoles("USER");
    newUser.setEnabled(true);
    AppUser saved = users.save(newUser);
    return ResponseEntity.created(URI.create("/api/auth/users/" + saved.getId())).build();
  }

  @GetMapping("/me")
  public ResponseEntity<?> me(Principal principal) {
    return ResponseEntity.ok(principal.getName());
  }

  @PostMapping("/forgot")
  public ResponseEntity<?> forgot(@RequestBody Map<String, String> body) {
    String email = body.getOrDefault("email", "").trim();
    if (email.isEmpty()) return ResponseEntity.badRequest().body("Email required");
    if (users.findByUsername(email).isEmpty()) return ResponseEntity.status(404).body("User not found");
    String otp = String.format("%06d", new Random().nextInt(1_000_000));
    PasswordResetToken t = new PasswordResetToken();
    t.setEmail(email);
    t.setToken(otp);
    t.setExpiresAt(Instant.now().plusSeconds(10 * 60));
    tokens.save(t);
    return ResponseEntity.ok(Map.of("email", email, "otp", otp));
  }

  @PostMapping("/reset")
  public ResponseEntity<?> reset(@RequestBody Map<String, String> body) {
    String email = body.getOrDefault("email", "").trim();
    String otp = body.getOrDefault("otp", "").trim();
    String newPass = body.getOrDefault("password", "");
    var tokenOpt = tokens.findTopByEmailAndTokenOrderByIdDesc(email, otp);
    if (tokenOpt.isEmpty()) return ResponseEntity.status(400).body("Invalid OTP");
    var token = tokenOpt.get();
    if (token.isUsed() || token.getExpiresAt().isBefore(Instant.now())) return ResponseEntity.status(400).body("OTP expired");
    var userOpt = users.findByUsername(email);
    if (userOpt.isEmpty()) return ResponseEntity.status(404).body("User not found");
    var user = userOpt.get();
    user.setPassword(newPass);
    users.save(user);
    token.setUsed(true);
    tokens.save(token);
    return ResponseEntity.ok().build();
  }
}
