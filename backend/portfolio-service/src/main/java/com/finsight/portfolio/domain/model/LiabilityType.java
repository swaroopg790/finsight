package com.finsight.portfolio.domain.model;

public enum LiabilityType {
    MORTGAGE     ("Mortgage",      "🏠"),
    STUDENT_LOAN ("Student Loan",  "🎓"),
    AUTO_LOAN    ("Auto Loan",     "🚗"),
    CREDIT_CARD  ("Credit Card",   "💳"),
    PERSONAL_LOAN("Personal Loan", "📝"),
    OTHER        ("Other Debt",    "📋");

    private final String label;
    private final String emoji;

    LiabilityType(String label, String emoji) { this.label = label; this.emoji = emoji; }

    public String label() { return label; }
    public String emoji() { return emoji; }
}
