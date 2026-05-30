package com.finsight.portfolio.api.controller;

import com.finsight.portfolio.api.dto.response.PortfolioNewsResponse;
import com.finsight.portfolio.domain.service.NewsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * REST endpoints for portfolio-filtered news intelligence.
 *
 * All endpoints require a valid JWT. The user's UUID is extracted from the
 * JWT subject to scope data to the authenticated user.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/news")
@RequiredArgsConstructor
public class NewsController {

    private final NewsService newsService;

    /**
     * GET /api/v1/news/feed
     *
     * Returns the full portfolio-filtered news feed including:
     * - Article list filtered to the user's holdings (15-article limit)
     * - Per-ticker sentiment (BULLISH / BEARISH / NEUTRAL)
     * - Upcoming earnings calendar
     * - AI-generated summary paragraph
     *
     * Served from a 15-minute Redis cache. The {@code stale} flag is true when
     * the cached copy is between 10–15 minutes old (frontend can show a refresh hint).
     */
    @GetMapping("/feed")
    public ResponseEntity<PortfolioNewsResponse> getNewsFeed(@AuthenticationPrincipal Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());
        log.debug("GET /api/v1/news/feed user={}", userId);
        return ResponseEntity.ok(newsService.getNewsFeed(userId));
    }

    /**
     * POST /api/v1/news/refresh
     *
     * Forces a cache bust and returns a freshly-built news feed.
     * Use sparingly — the Polygon free tier allows 5 requests/minute.
     */
    @PostMapping("/refresh")
    public ResponseEntity<PortfolioNewsResponse> refreshNewsFeed(@AuthenticationPrincipal Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());
        log.info("POST /api/v1/news/refresh user={}", userId);
        return ResponseEntity.ok(newsService.refreshNewsFeed(userId));
    }
}
