package com.clarify.doubts.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.Size;
import java.time.Instant;

@Entity
public class Post {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;
  @Column(nullable = false)
  private String authorUsername;
  @Size(max = 1000)
  private String content;
  private String imageUrl;
  @Column(nullable = false)
  private Instant createdAt = Instant.now();
  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public String getAuthorUsername() { return authorUsername; }
  public void setAuthorUsername(String authorUsername) { this.authorUsername = authorUsername; }
  public String getContent() { return content; }
  public void setContent(String content) { this.content = content; }
  public String getImageUrl() { return imageUrl; }
  public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
  public Instant getCreatedAt() { return createdAt; }
  public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
