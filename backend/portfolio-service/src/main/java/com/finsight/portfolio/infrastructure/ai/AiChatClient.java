package com.finsight.portfolio.infrastructure.ai;

import com.finsight.portfolio.api.dto.request.ChatMessageRequest;
import com.finsight.portfolio.api.dto.response.AccountResponse;
import com.finsight.portfolio.api.dto.response.ChatMessageResponse;
import com.finsight.portfolio.api.dto.response.HoldingResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Calls the Python AI service for single-turn and multi-turn portfolio chat.
 *
 * Stateless: conversation history is supplied by the caller (stored on the frontend)
 * and forwarded verbatim to the AI service. The backend never persists chat messages.
 *
 * Uses SimpleClientHttpRequestFactory (HttpURLConnection) to avoid the JDK HTTP
 * client keep-alive bug with Python/uvicorn (see AiInsightClient for full explanation).
 */
@Slf4j
@Component
public class AiChatClient {

    private final RestClient restClient = RestClient.builder()
            .requestFactory(new SimpleClientHttpRequestFactory())
            .build();

    @Value("${finsight.ai-service.url:http://localhost:8000}")
    private String aiServiceUrl;

    /**
     * Sends a user message + conversation history + current portfolio snapshot
     * to the AI chat endpoint and returns the assistant's reply.
     *
     * @return ChatMessageResponse, or a fallback error message if the AI service is down
     */
    public ChatMessageResponse chat(String userId,
                                     ChatMessageRequest request,
                                     List<HoldingResponse> holdings,
                                     List<AccountResponse> accounts) {
        try {
            // Cap conversation history at 20 entries to control token usage
            List<Map<String, String>> history = request.conversationHistory().stream()
                    .skip(Math.max(0, request.conversationHistory().size() - 20))
                    .toList();

            Map<String, Object> body = new HashMap<>();
            body.put("user_id",              userId);
            body.put("message",              request.message());
            body.put("conversation_history", history);
            body.put("holdings",             holdings);
            body.put("accounts",             accounts);

            Map<String, Object> response = restClient.post()
                    .uri(aiServiceUrl + "/chat/message")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});

            if (response == null || !response.containsKey("reply")) {
                log.warn("AI chat returned null/empty payload for user={}", userId);
                return new ChatMessageResponse("I'm having trouble responding right now. Please try again in a moment.");
            }

            String reply = (String) response.get("reply");
            log.debug("Chat reply for user={}: {}…", userId, reply.substring(0, Math.min(60, reply.length())));
            return new ChatMessageResponse(reply);

        } catch (Exception e) {
            log.error("AI chat service error for user={}: {}", userId, e.getMessage());
            return new ChatMessageResponse(
                    "I'm currently unavailable. Make sure the AI service is running and try again."
            );
        }
    }
}
