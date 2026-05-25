package com.finsight.portfolio.config;

import com.plaid.client.ApiClient;
import com.plaid.client.request.PlaidApi;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.HashMap;

/**
 * Configures the Plaid SDK client.
 * Only active when finsight.plaid.mode=sandbox (i.e. PLAID_MODE=sandbox).
 */
@Configuration
@ConditionalOnProperty(name = "finsight.plaid.mode", havingValue = "sandbox")
public class PlaidConfig {

    @Value("${finsight.plaid.client-id}")
    private String clientId;

    @Value("${finsight.plaid.secret}")
    private String secret;

    @Bean
    public PlaidApi plaidApi() {
        HashMap<String, String> apiKeys = new HashMap<>();
        apiKeys.put("clientId", clientId);
        apiKeys.put("secret", secret);
        ApiClient apiClient = new ApiClient(apiKeys);
        apiClient.setPlaidAdapter(ApiClient.Sandbox);
        return apiClient.createService(PlaidApi.class);
    }
}
