package com.clarify.doubts.service;

import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class TrendingNewsService {
  private static final int MAX_LIMIT = 20;
  private final HttpClient client = HttpClient.newBuilder()
    .connectTimeout(Duration.ofSeconds(5))
    .build();

  public List<TrendingNewsItem> fetchTrending(String topic, int limit) {
    String safeTopic = normalizeTopic(topic);
    int safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
    try {
      List<TrendingNewsItem> live = fetchFromGoogleNews(safeTopic, safeLimit);
      if (!live.isEmpty()) return live;
    } catch (Exception ignored) {
      // Fallback is returned below if live feed fails.
    }
    return fallbackItems(safeTopic, safeLimit);
  }

  private List<TrendingNewsItem> fetchFromGoogleNews(String topic, int limit) throws Exception {
    String query = URLEncoder.encode(topic + " latest", StandardCharsets.UTF_8);
    URI uri = URI.create("https://news.google.com/rss/search?q=" + query + "&hl=en-US&gl=US&ceid=US:en");
    HttpRequest request = HttpRequest.newBuilder(uri)
      .GET()
      .timeout(Duration.ofSeconds(8))
      .header("Accept", "application/rss+xml, application/xml")
      .build();
    HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    if (response.statusCode() < 200 || response.statusCode() >= 300) {
      throw new IllegalStateException("Unable to fetch feed");
    }

    DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
    factory.setNamespaceAware(false);
    try {
      factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
      factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
      factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
      factory.setXIncludeAware(false);
      factory.setExpandEntityReferences(false);
    } catch (Exception ignored) {
      // Not all parsers support every hardening option.
    }

    Document doc = factory.newDocumentBuilder().parse(new InputSource(new StringReader(response.body())));
    NodeList itemNodes = doc.getElementsByTagName("item");
    List<TrendingNewsItem> items = new ArrayList<>();
    for (int i = 0; i < itemNodes.getLength() && items.size() < limit; i++) {
      Element item = (Element) itemNodes.item(i);
      String rawTitle = text(item, "title");
      if (rawTitle.isBlank()) continue;

      String source = text(item, "source");
      String cleanTitle = rawTitle;
      int splitAt = rawTitle.lastIndexOf(" - ");
      if (source.isBlank() && splitAt > 0 && splitAt < rawTitle.length() - 3) {
        cleanTitle = rawTitle.substring(0, splitAt).trim();
        source = rawTitle.substring(splitAt + 3).trim();
      }

      String link = text(item, "link");
      String publishedAt = toIsoDate(text(item, "pubDate"));
      String summary = shortSummary(text(item, "description"));

      items.add(new TrendingNewsItem(
        cleanTitle,
        link,
        source.isBlank() ? "Google News" : source,
        publishedAt,
        summary
      ));
    }
    return items;
  }

  private List<TrendingNewsItem> fallbackItems(String topic, int limit) {
    String baseLink = "https://news.google.com/search?q=" + URLEncoder.encode(topic, StandardCharsets.UTF_8)
      + "&hl=en-US&gl=US&ceid=US:en";

    Map<String, List<String>> samples = new LinkedHashMap<>();
    samples.put("science", List.of(
      "Top research breakthroughs this week",
      "Major lab experiments shaping 2026",
      "New climate and environment science findings",
      "Health science updates from global journals",
      "AI and biotech cross-disciplinary discoveries"
    ));
    samples.put("space", List.of(
      "Latest mission updates from space agencies",
      "New telescope discoveries and deep-sky findings",
      "Rocket launches and satellite deployment highlights",
      "Moon and Mars program progress this week",
      "Astronomy observations drawing global attention"
    ));
    samples.put("sports", List.of(
      "Top match results and tournament updates",
      "Player transfer and team strategy headlines",
      "Injury reports and comeback stories",
      "Championship race analysis across leagues",
      "Emerging athletes and record performances"
    ));
    samples.put("politics", List.of(
      "Key policy moves and government decisions",
      "Election campaign developments and polling trends",
      "Parliament and legislative debate highlights",
      "Global diplomatic updates and summit outcomes",
      "Regulation and public policy stories to watch"
    ));
    samples.put("geography", List.of(
      "Natural events and regional impact reports",
      "Urban growth and population shift trends",
      "Climate, terrain, and ecosystem mapping updates",
      "Geospatial technology and remote sensing insights",
      "Country-level development and resource stories"
    ));
    samples.put("history", List.of(
      "Archaeology finds changing known timelines",
      "Museum and archive discoveries in focus",
      "Historical research papers trending this week",
      "New analysis of major world events",
      "Restoration projects uncovering old records"
    ));
    samples.put("physics", List.of(
      "Quantum research updates and practical implications",
      "Particle physics results from major labs",
      "Astrophysics models under new review",
      "Materials physics breakthroughs for industry",
      "Experimental physics studies with notable findings"
    ));
    samples.put("psychology", List.of(
      "Behavior science studies making headlines",
      "Mental health research updates and evidence",
      "Cognition and learning experiments in focus",
      "Social psychology findings with real-world impact",
      "Neuroscience and psychology crossover stories"
    ));

    List<String> source = samples.getOrDefault(topic.toLowerCase(), List.of(
      "Trending updates for this topic",
      "Latest incidents and global coverage",
      "Top stories and analysis right now",
      "Most discussed developments this week",
      "Breaking updates across major outlets"
    ));

    List<TrendingNewsItem> items = new ArrayList<>();
    for (int i = 0; i < source.size() && items.size() < limit; i++) {
      items.add(new TrendingNewsItem(
        source.get(i),
        baseLink,
        "Google News",
        Instant.now().toString(),
        "Open this topic to view the latest live articles from global sources."
      ));
    }
    return items;
  }

  private static String normalizeTopic(String topic) {
    if (topic == null || topic.isBlank()) return "science";
    return topic.trim().replaceAll("\\s+", " ");
  }

  private static String text(Element root, String tag) {
    NodeList nodes = root.getElementsByTagName(tag);
    if (nodes.getLength() == 0 || nodes.item(0) == null) return "";
    String value = nodes.item(0).getTextContent();
    return value == null ? "" : value.trim();
  }

  private static String toIsoDate(String value) {
    if (value == null || value.isBlank()) return Instant.now().toString();
    try {
      return ZonedDateTime.parse(value).toInstant().toString();
    } catch (DateTimeParseException ignored) {
      return Instant.now().toString();
    }
  }

  private static String shortSummary(String raw) {
    if (raw == null || raw.isBlank()) return "Open article for full details.";
    String summary = raw
      .replaceAll("<[^>]*>", " ")
      .replace("&nbsp;", " ")
      .replace("&amp;", "&")
      .replace("&quot;", "\"")
      .replace("&#39;", "'")
      .replaceAll("\\s+", " ")
      .trim();
    if (summary.length() <= 180) return summary;
    return summary.substring(0, 177) + "...";
  }

  public record TrendingNewsItem(String title, String link, String source, String publishedAt, String summary) {}
}
