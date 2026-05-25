package com.finsight.portfolio.api.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;

public record ChatMessageRequest(
        @NotBlank
        @Size(max = 2000, message = "Message must be under 2000 characters")
        String message,

        /**
         * Prior turns in this conversation, oldest first.
         * Each entry: {"role": "user"|"assistant", "content": "..."}
         * Sent from the frontend so the backend stays stateless.
         * Capped at 20 entries server-side before forwarding to AI service.
         */
        List<Map<String, String>> conversationHistory
) {
    public ChatMessageRequest {
        if (conversationHistory == null) conversationHistory = List.of();
    }
}
