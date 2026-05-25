package com.finsight.portfolio.api.dto.response;

import java.time.Instant;
import java.util.List;

/**
 * AI-generated portfolio insights returned to the frontend.
 *
 * Serialised as camelCase JSON by Spring Boot 4's Jackson 3 ObjectMapper:
 *   { "summary": "...", "riskFlags": [...], "suggestions": [...], "generatedAt": "..." }
 */
public record InsightResponse(
        String       summary,
        List<String> riskFlags,
        List<String> suggestions,
        Instant      generatedAt
) {}
