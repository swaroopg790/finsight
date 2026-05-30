package com.finsight.portfolio.domain.model;

/**
 * Supported financial goal types.
 *
 * <p>Each type ships with sensible default expected return and volatility rates
 * (annualised) that can be overridden by the user.  Defaults are deliberately
 * conservative: equity-heavy allocations for long-horizon goals, lower-volatility
 * for near-term goals (home purchase, emergency fund).
 */
public enum GoalType {

    RETIREMENT(
            "Retirement",
            "🏖️",
            0.07,   // 7% expected annual return (60/40 equity/bond mix)
            0.12    // 12% annual volatility
    ),

    EMERGENCY_FUND(
            "Emergency Fund",
            "🛡️",
            0.045,  // 4.5% — high-yield savings / short-term bonds
            0.02    // very low volatility
    ),

    HOME_PURCHASE(
            "Home Purchase",
            "🏡",
            0.05,   // 5% — moderate mix while saving
            0.08
    ),

    COLLEGE(
            "College Fund",
            "🎓",
            0.065,  // 6.5% — 529-style equity glide path
            0.11
    ),

    WEDDING(
            "Wedding",
            "💍",
            0.04,   // 4% — short-term, low risk
            0.03
    ),

    CUSTOM(
            "Custom Goal",
            "⭐",
            0.06,
            0.10
    );

    private final String  label;
    private final String  emoji;
    private final double  defaultReturnPct;
    private final double  defaultVolatilityPct;

    GoalType(String label, String emoji, double defaultReturnPct, double defaultVolatilityPct) {
        this.label               = label;
        this.emoji               = emoji;
        this.defaultReturnPct    = defaultReturnPct;
        this.defaultVolatilityPct = defaultVolatilityPct;
    }

    public String  label()               { return label; }
    public String  emoji()               { return emoji; }
    public double  defaultReturnPct()    { return defaultReturnPct; }
    public double  defaultVolatilityPct(){ return defaultVolatilityPct; }
}
