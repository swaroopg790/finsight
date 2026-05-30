package com.finsight.portfolio.domain.model;

/**
 * Spending categories used for bank transaction classification.
 *
 * Each category maps to a display label and an emoji used in the frontend.
 */
public enum SpendingCategory {
    GROCERIES,
    DINING,
    SUBSCRIPTIONS,
    UTILITIES,
    TRANSPORT,
    SHOPPING,
    HEALTHCARE,
    ENTERTAINMENT,
    INCOME,
    TRANSFER,
    OTHER;

    /** Human-readable label for API responses. */
    public String label() {
        return switch (this) {
            case GROCERIES     -> "Groceries";
            case DINING        -> "Dining & Coffee";
            case SUBSCRIPTIONS -> "Subscriptions";
            case UTILITIES     -> "Utilities & Bills";
            case TRANSPORT     -> "Transport";
            case SHOPPING      -> "Shopping";
            case HEALTHCARE    -> "Healthcare";
            case ENTERTAINMENT -> "Entertainment";
            case INCOME        -> "Income";
            case TRANSFER      -> "Transfer";
            case OTHER         -> "Other";
        };
    }

    /** Emoji used in the frontend budget cards. */
    public String emoji() {
        return switch (this) {
            case GROCERIES     -> "🛒";
            case DINING        -> "🍽️";
            case SUBSCRIPTIONS -> "📱";
            case UTILITIES     -> "⚡";
            case TRANSPORT     -> "🚗";
            case SHOPPING      -> "🛍️";
            case HEALTHCARE    -> "🏥";
            case ENTERTAINMENT -> "🎬";
            case INCOME        -> "💵";
            case TRANSFER      -> "🔄";
            case OTHER         -> "📦";
        };
    }
}
