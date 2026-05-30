package com.finsight.portfolio.domain.service;

import com.finsight.portfolio.domain.model.GoalType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Regex-based natural-language parser for goal creation prompts.
 *
 * <p>Examples handled:
 * <ul>
 *   <li>"I want to retire at 58 with $2M"</li>
 *   <li>"Save $500k for a house by 2030"</li>
 *   <li>"Build a $30,000 emergency fund in 2 years"</li>
 *   <li>"Save $150,000 for my kids college by 2035"</li>
 *   <li>"I need $50k for a wedding in 18 months"</li>
 *   <li>"Grow my portfolio to $1 million in 10 years"</li>
 * </ul>
 */
@Slf4j
@Service
public class GoalNlpParser {

    // ── Amount patterns ───────────────────────────────────────────────────────
    // Matches: $2M, $2.5M, $500k, $1,000,000, $50000
    private static final Pattern AMOUNT_PATTERN = Pattern.compile(
            "\\$([\\d,]+(?:\\.\\d+)?)(m|k)?",
            Pattern.CASE_INSENSITIVE);

    // ── Retirement age pattern ────────────────────────────────────────────────
    private static final Pattern RETIRE_AGE_PATTERN = Pattern.compile(
            "retire\\s+(?:at|by|when\\s+i(?:'m|\\s+am)?\\s+)?(\\d{2})",
            Pattern.CASE_INSENSITIVE);

    // ── Explicit year target (by 2030, in 2035) ───────────────────────────────
    private static final Pattern BY_YEAR_PATTERN = Pattern.compile(
            "(?:by|in|before)\\s+(20[2-9]\\d)",
            Pattern.CASE_INSENSITIVE);

    // ── Relative time (in N years / in N months) ─────────────────────────────
    private static final Pattern IN_YEARS_PATTERN = Pattern.compile(
            "in\\s+(\\d+)\\s+year",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern IN_MONTHS_PATTERN = Pattern.compile(
            "in\\s+(\\d+)\\s+month",
            Pattern.CASE_INSENSITIVE);

    // ── Goal type keywords ────────────────────────────────────────────────────
    private static final Pattern RETIREMENT_KW  = Pattern.compile("retir",         Pattern.CASE_INSENSITIVE);
    private static final Pattern HOME_KW        = Pattern.compile("hous|home|property|down.?payment", Pattern.CASE_INSENSITIVE);
    private static final Pattern COLLEGE_KW     = Pattern.compile("colleg|school|educat|529|tuition", Pattern.CASE_INSENSITIVE);
    private static final Pattern WEDDING_KW     = Pattern.compile("wedding|marry|marriage",            Pattern.CASE_INSENSITIVE);
    private static final Pattern EMERGENCY_KW   = Pattern.compile("emergency|rainy.?day|safety.?net",  Pattern.CASE_INSENSITIVE);

    public record ParsedGoal(
            GoalType      goalType,
            String        name,
            BigDecimal    targetAmount,
            LocalDate     targetDate,
            BigDecimal    monthlyContribution  // null if not mentioned
    ) {}

    /**
     * Parses a free-form goal string and returns a best-effort {@link ParsedGoal}.
     * Returns {@link Optional#empty()} only if no amount can be extracted.
     */
    public Optional<ParsedGoal> parse(String text) {
        if (text == null || text.isBlank()) return Optional.empty();

        // 1. Detect goal type
        GoalType goalType = detectGoalType(text);

        // 2. Extract target amount (required)
        Optional<BigDecimal> amountOpt = extractAmount(text);
        if (amountOpt.isEmpty()) {
            log.debug("NLP parser: no amount found in '{}'", text);
            return Optional.empty();
        }
        BigDecimal targetAmount = amountOpt.get();

        // 3. Derive target date
        LocalDate targetDate = extractTargetDate(text, goalType);

        // 4. Build a human-readable goal name
        String name = buildName(goalType, targetAmount, targetDate);

        // 5. Optional: monthly contribution (if mentioned)
        // Pattern: "contribute $500/month", "save $500 a month", "put $500 per month"
        BigDecimal monthly = extractMonthlyContribution(text);

        return Optional.of(new ParsedGoal(goalType, name, targetAmount, targetDate, monthly));
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private GoalType detectGoalType(String text) {
        if (RETIREMENT_KW.matcher(text).find()) return GoalType.RETIREMENT;
        if (HOME_KW.matcher(text).find())       return GoalType.HOME_PURCHASE;
        if (COLLEGE_KW.matcher(text).find())    return GoalType.COLLEGE;
        if (WEDDING_KW.matcher(text).find())    return GoalType.WEDDING;
        if (EMERGENCY_KW.matcher(text).find())  return GoalType.EMERGENCY_FUND;
        return GoalType.CUSTOM;
    }

    private Optional<BigDecimal> extractAmount(String text) {
        Matcher m = AMOUNT_PATTERN.matcher(text);
        if (!m.find()) return Optional.empty();

        String numStr   = m.group(1).replace(",", "");
        String suffix   = m.group(2);
        double value    = Double.parseDouble(numStr);

        if ("m".equalsIgnoreCase(suffix))      value *= 1_000_000;
        else if ("k".equalsIgnoreCase(suffix)) value *= 1_000;

        return Optional.of(BigDecimal.valueOf(value));
    }

    private LocalDate extractTargetDate(String text, GoalType goalType) {
        LocalDate today = LocalDate.now();

        // Retirement age → estimate target year
        if (goalType == GoalType.RETIREMENT) {
            Matcher m = RETIRE_AGE_PATTERN.matcher(text);
            if (m.find()) {
                int retireAge = Integer.parseInt(m.group(1));
                // Assume average user age of 35 — offset from today
                int yearsToRetirement = Math.max(1, retireAge - 35);
                return today.plusYears(yearsToRetirement);
            }
        }

        // Explicit calendar year
        Matcher byYear = BY_YEAR_PATTERN.matcher(text);
        if (byYear.find()) {
            int year = Integer.parseInt(byYear.group(1));
            return LocalDate.of(year, 12, 31);
        }

        // Relative years
        Matcher inYears = IN_YEARS_PATTERN.matcher(text);
        if (inYears.find()) {
            int years = Integer.parseInt(inYears.group(1));
            return today.plusYears(years);
        }

        // Relative months
        Matcher inMonths = IN_MONTHS_PATTERN.matcher(text);
        if (inMonths.find()) {
            int months = Integer.parseInt(inMonths.group(1));
            return today.plusMonths(months);
        }

        // Default horizons by goal type
        return switch (goalType) {
            case RETIREMENT    -> today.plusYears(25);
            case HOME_PURCHASE -> today.plusYears(5);
            case EMERGENCY_FUND -> today.plusYears(2);
            case COLLEGE       -> today.plusYears(15);
            case WEDDING       -> today.plusYears(2);
            default            -> today.plusYears(10);
        };
    }

    private BigDecimal extractMonthlyContribution(String text) {
        // Match: "$500/month", "$500 a month", "$500 per month"
        Pattern monthlyPat = Pattern.compile(
                "\\$([\\d,]+(?:\\.\\d+)?)(m|k)?\\s*(?:/|per|a)\\s*month",
                Pattern.CASE_INSENSITIVE);
        Matcher m = monthlyPat.matcher(text);
        if (!m.find()) return null;

        String numStr = m.group(1).replace(",", "");
        String suffix = m.group(2);
        double value  = Double.parseDouble(numStr);
        if ("m".equalsIgnoreCase(suffix))      value *= 1_000_000;
        else if ("k".equalsIgnoreCase(suffix)) value *= 1_000;

        return BigDecimal.valueOf(value);
    }

    private String buildName(GoalType goalType, BigDecimal targetAmount, LocalDate targetDate) {
        String amtStr = formatAmount(targetAmount);
        return switch (goalType) {
            case RETIREMENT    -> "Retire with " + amtStr;
            case HOME_PURCHASE -> amtStr + " Down Payment";
            case COLLEGE       -> amtStr + " College Fund";
            case WEDDING       -> amtStr + " Wedding Fund";
            case EMERGENCY_FUND -> amtStr + " Emergency Fund";
            default            -> amtStr + " by " + targetDate.getYear();
        };
    }

    private String formatAmount(BigDecimal amount) {
        double v = amount.doubleValue();
        if (v >= 1_000_000) return String.format("$%.1fM", v / 1_000_000);
        if (v >= 1_000)     return String.format("$%.0fk", v / 1_000);
        return String.format("$%.0f", v);
    }
}
