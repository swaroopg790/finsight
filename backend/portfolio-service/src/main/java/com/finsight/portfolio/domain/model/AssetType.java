package com.finsight.portfolio.domain.model;

public enum AssetType {
    REAL_ESTATE("Real Estate",   "🏡"),
    VEHICLE    ("Vehicle",       "🚗"),
    CASH       ("Cash / Savings","💵"),
    CRYPTO     ("Crypto",        "₿"),
    OTHER      ("Other Asset",   "📦");

    private final String label;
    private final String emoji;

    AssetType(String label, String emoji) { this.label = label; this.emoji = emoji; }

    public String label() { return label; }
    public String emoji() { return emoji; }
}
