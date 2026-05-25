package com.finsight.portfolio.api.controller;

import com.finsight.portfolio.api.dto.request.ChatMessageRequest;
import com.finsight.portfolio.api.dto.response.AccountResponse;
import com.finsight.portfolio.api.dto.response.ChatMessageResponse;
import com.finsight.portfolio.api.dto.response.HoldingResponse;
import com.finsight.portfolio.domain.service.PortfolioService;
import com.finsight.portfolio.infrastructure.ai.AiChatClient;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * AI portfolio chat — multi-turn, portfolio-context-aware conversation.
 *
 * The backend is stateless: conversation history is managed on the client and
 * forwarded with each request. The backend fetches the latest portfolio snapshot
 * and passes it to the AI service so every reply has up-to-date context.
 */
@RestController
@RequestMapping("/api/v1/chat")
@RequiredArgsConstructor
public class ChatController {

    private final PortfolioService portfolioService;
    private final AiChatClient     aiChatClient;

    /**
     * Sends a message to the AI copilot and returns its reply.
     * Holdings + accounts are fetched fresh for each call so the AI always has
     * the latest portfolio data without the client needing to send it.
     */
    @PostMapping("/message")
    public ChatMessageResponse message(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody ChatMessageRequest request) {

        UUID userId = UUID.fromString(jwt.getSubject());

        // Fetch fresh portfolio context — ensures AI replies reflect latest prices
        List<HoldingResponse> holdings = portfolioService.getHoldings(userId);
        List<AccountResponse> accounts = portfolioService.getAccounts(userId);

        return aiChatClient.chat(jwt.getSubject(), request, holdings, accounts);
    }
}
