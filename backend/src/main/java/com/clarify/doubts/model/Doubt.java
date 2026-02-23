package com.clarify.doubts.model;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonManagedReference;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

@Entity
public class Doubt {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @NotBlank
  @Size(max = 200)
  private String title;

  @NotBlank
  @Column(length = 5000)
  private String description;

  @NotBlank
  @Size(max = 100)
  private String authorName;

  @Size(max = 100)
  private String authorCredential;

  @Enumerated(EnumType.STRING)
  private DoubtDifficulty difficulty = DoubtDifficulty.MEDIUM;

  @ElementCollection
  @CollectionTable(name = "doubt_topics", joinColumns = @JoinColumn(name = "doubt_id"))
  @Column(name = "topic", length = 60)
  private List<String> topics = new ArrayList<>();

  @PositiveOrZero
  private Integer bountyPoints = 0;

  @Enumerated(EnumType.STRING)
  private DoubtStatus status = DoubtStatus.OPEN;

  private Instant createdAt = Instant.now();

  @OneToMany(mappedBy = "doubt", cascade = CascadeType.ALL, orphanRemoval = true)
  @JsonManagedReference
  private List<Reply> replies = new ArrayList<>();

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public String getTitle() {
    return title;
  }

  public void setTitle(String title) {
    this.title = title;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }

  public String getAuthorName() {
    return authorName;
  }

  public void setAuthorName(String authorName) {
    this.authorName = authorName;
  }

  public String getAuthorCredential() {
    return authorCredential;
  }

  public void setAuthorCredential(String authorCredential) {
    this.authorCredential = authorCredential;
  }

  public DoubtDifficulty getDifficulty() {
    return difficulty;
  }

  public void setDifficulty(DoubtDifficulty difficulty) {
    this.difficulty = difficulty;
  }

  public List<String> getTopics() {
    return topics;
  }

  public void setTopics(List<String> topics) {
    this.topics = topics;
  }

  public Integer getBountyPoints() {
    return bountyPoints;
  }

  public void setBountyPoints(Integer bountyPoints) {
    this.bountyPoints = bountyPoints;
  }

  public DoubtStatus getStatus() {
    return status;
  }

  public void setStatus(DoubtStatus status) {
    this.status = status;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(Instant createdAt) {
    this.createdAt = createdAt;
  }

  public List<Reply> getReplies() {
    return replies;
  }

  public void setReplies(List<Reply> replies) {
    this.replies = replies;
  }
}
