package com.clarify.doubts.web;

import com.clarify.doubts.service.TrendingNewsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/trending")
public class TrendingController {
  private final TrendingNewsService trendingNewsService;

  public TrendingController(TrendingNewsService trendingNewsService) {
    this.trendingNewsService = trendingNewsService;
  }

  @GetMapping
  public List<TrendingNewsService.TrendingNewsItem> getTrending(
    @RequestParam String topic,
    @RequestParam(defaultValue = "8") int limit
  ) {
    return trendingNewsService.fetchTrending(topic, limit);
  }
}
