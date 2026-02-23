package com.clarify.doubts.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.NoOpPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.web.SecurityFilterChain;

import com.clarify.doubts.repo.AppUserRepository;

@Configuration
@EnableWebSecurity
public class SecurityConfig {
  private final AppUserRepository usersRepo;
  @Autowired(required = false)
  private ClientRegistrationRepository clientRegistrations;
  public SecurityConfig(AppUserRepository usersRepo) {
    this.usersRepo = usersRepo;
  }
  @Bean
  public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http.csrf(csrf -> csrf.disable());
    http.authorizeHttpRequests(auth -> auth
      .requestMatchers("/h2-console/**").permitAll()
      .requestMatchers("/api/auth/signup").permitAll()
      .requestMatchers("/api/auth/forgot").permitAll()
      .requestMatchers("/api/auth/reset").permitAll()
      .requestMatchers("/api/auth/me").authenticated()
      .requestMatchers(HttpMethod.GET, "/uploads/**").permitAll()
      .requestMatchers(HttpMethod.GET, "/api/posts/**").permitAll()
      .requestMatchers(HttpMethod.GET, "/api/trending/**").permitAll()
      .requestMatchers(HttpMethod.POST, "/api/posts/**").authenticated()
      .requestMatchers("/api/follow/**").authenticated()
      .requestMatchers(HttpMethod.GET, "/api/doubts/**").permitAll()
      .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
      .requestMatchers(HttpMethod.POST, "/api/doubts/**").authenticated()
      .requestMatchers(HttpMethod.PATCH, "/api/doubts/**").authenticated()
      .anyRequest().authenticated()
    );
    http.headers(headers -> headers.frameOptions(frame -> frame.disable()));
    http.httpBasic(basic -> {});
    if (clientRegistrations != null) {
      http.oauth2Login(oauth -> {});
    }
    return http.build();
  }

  @Bean
  public UserDetailsService userDetailsService() {
    return username -> usersRepo.findByUsernameIgnoreCase(username)
      .map(u -> User.withUsername(u.getUsername())
        .password(u.getPassword())
        .roles(u.getRoles().split(","))
        .disabled(!u.isEnabled())
        .build())
      .orElseThrow(() -> new UsernameNotFoundException("User not found"));
  }

  @Bean
  public PasswordEncoder passwordEncoder() {
    return NoOpPasswordEncoder.getInstance();
  }
}
