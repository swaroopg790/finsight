package com.finsight.portfolio.api.dto.response;

import java.time.Instant;

public record ChatMessageResponse(String reply, Instant timestamp) {
    public ChatMessageResponse(String reply) {
        this(reply, Instant.now());
    }
}
