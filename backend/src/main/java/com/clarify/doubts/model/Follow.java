package com.clarify.doubts.model;

import jakarta.persistence.*;

@Entity
@Table(uniqueConstraints = @UniqueConstraint(columnNames = {"follower", "following"}))
public class Follow {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;
  @Column(nullable = false)
  private String follower;
  @Column(nullable = false)
  private String following;
  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public String getFollower() { return follower; }
  public void setFollower(String follower) { this.follower = follower; }
  public String getFollowing() { return following; }
  public void setFollowing(String following) { this.following = following; }
}
