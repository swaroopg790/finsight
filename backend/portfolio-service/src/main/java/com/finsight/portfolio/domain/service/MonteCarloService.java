package com.finsight.portfolio.domain.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.finsight.portfolio.domain.model.FinancialGoal;
import com.finsight.portfolio.domain.model.GoalProjection;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Monte Carlo retirement / goal simulation using Geometric Brownian Motion.
 *
 * <p>Algorithm:
 * <ol>
 *   <li>Run {@value #PATHS} independent simulation paths over the goal horizon.</li>
 *   <li>Each path advances monthly: V(t+1) = [V(t) + contribution] × exp(μ_m + σ_m × Z)
 *       where Z ~ N(0,1), μ_m = annualReturn/12, σ_m = annualVol/√12.</li>
 *   <li>Collect terminal values; count paths ≥ targetAmount → success probability.</li>
 *   <li>Compute P10/P25/P50/P75/P90 percentile bands at each year for chart rendering.</li>
 * </ol>
 *
 * <p>Thread-safe: each call creates its own Random instance seeded from system time.
 */
@Slf4j
@Service
public class MonteCarloService {

    private static final int    PATHS = 5000;
    private static final double MONTHS_PER_YEAR = 12.0;

    // Jackson 2 instance (available via plaid-java transitive dep) for JSON serialisation.
    private static final ObjectMapper JSON = new ObjectMapper();

    /**
     * Runs a full Monte Carlo simulation for the given goal and returns a
     * {@link GoalProjection} (not yet persisted — caller is responsible for save).
     */
    public GoalProjection simulate(FinancialGoal goal) {
        long startMs = System.currentTimeMillis();

        double currentValue   = goal.getCurrentValue().doubleValue();
        double monthlyContrib = goal.getMonthlyContribution().doubleValue();
        double annualReturn   = goal.getExpectedReturnPct().doubleValue();
        double annualVol      = goal.getVolatilityPct().doubleValue();
        double targetAmount   = goal.getTargetAmount().doubleValue();

        LocalDate today       = LocalDate.now();
        LocalDate targetDate  = goal.getTargetDate();
        long totalMonths      = ChronoUnit.MONTHS.between(today, targetDate);

        if (totalMonths <= 0) {
            // Goal is already past — trivial result
            return buildTrivialProjection(goal, currentValue, targetAmount);
        }

        int horizonYears = (int) Math.ceil(totalMonths / MONTHS_PER_YEAR);

        // Monthly drift and vol parameters
        double mu    = annualReturn / MONTHS_PER_YEAR;
        double sigma = annualVol / Math.sqrt(MONTHS_PER_YEAR);

        // paths[p][y] = portfolio value at end of year y for path p
        double[][] yearlySnapshots = new double[PATHS][horizonYears];
        double[]   finalValues     = new double[PATHS];

        Random rng = new Random(System.nanoTime());

        for (int p = 0; p < PATHS; p++) {
            double value = currentValue;
            int yearIndex = 0;

            for (int m = 1; m <= totalMonths; m++) {
                double z     = rng.nextGaussian();
                double shock = Math.exp(mu - 0.5 * sigma * sigma + sigma * z);
                value = (value + monthlyContrib) * shock;
                if (value < 0) value = 0; // floor at zero

                if (m % 12 == 0) {
                    yearlySnapshots[p][yearIndex++] = value;
                }
            }
            // If total months isn't divisible by 12, capture the last partial year
            if (yearIndex < horizonYears) {
                yearlySnapshots[p][yearIndex] = value;
            }
            finalValues[p] = value;
        }

        // ── Success probability ───────────────────────────────────────────────
        long successes = 0;
        for (double v : finalValues) {
            if (v >= targetAmount) successes++;
        }
        double successProb = (double) successes / PATHS;

        // ── Final value percentiles ───────────────────────────────────────────
        double[] sorted = Arrays.copyOf(finalValues, PATHS);
        Arrays.sort(sorted);
        double p10Final = percentile(sorted, 10);
        double p25Final = percentile(sorted, 25);
        double p50Final = percentile(sorted, 50);
        double p75Final = percentile(sorted, 75);
        double p90Final = percentile(sorted, 90);

        // ── Yearly band snapshots for chart ──────────────────────────────────
        List<Map<String, Object>> bands = new ArrayList<>();
        int startYear = today.getYear();
        for (int y = 0; y < horizonYears; y++) {
            double[] yearSlice = new double[PATHS];
            for (int p = 0; p < PATHS; p++) {
                yearSlice[p] = yearlySnapshots[p][y];
            }
            Arrays.sort(yearSlice);

            Map<String, Object> band = new LinkedHashMap<>();
            band.put("year", startYear + y + 1);
            band.put("p10",  round2(percentile(yearSlice, 10)));
            band.put("p25",  round2(percentile(yearSlice, 25)));
            band.put("p50",  round2(percentile(yearSlice, 50)));
            band.put("p75",  round2(percentile(yearSlice, 75)));
            band.put("p90",  round2(percentile(yearSlice, 90)));
            bands.add(band);
        }

        String bandsJson;
        try {
            bandsJson = JSON.writeValueAsString(bands);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialise yearly bands for goal {}", goal.getId(), e);
            bandsJson = "[]";
        }

        long elapsedMs = System.currentTimeMillis() - startMs;
        log.info("Monte Carlo for goal={} ({} paths, {} months): success={}% in {}ms",
                goal.getId(), PATHS, totalMonths,
                String.format("%.1f", successProb * 100), elapsedMs);

        return GoalProjection.builder()
                .goal(goal)
                .successProbability(BigDecimal.valueOf(successProb).setScale(4, RoundingMode.HALF_UP))
                .p10Final(bd(p10Final))
                .p25Final(bd(p25Final))
                .p50Final(bd(p50Final))
                .p75Final(bd(p75Final))
                .p90Final(bd(p90Final))
                .yearlyBands(bandsJson)
                .simulationPaths(PATHS)
                .build();
    }

    // ── What-If: re-simulate with overridden parameters without persisting ────

    public record WhatIfInput(
            double currentValue,
            double monthlyContribution,
            double annualReturn,
            double annualVol,
            double targetAmount,
            int    horizonMonths
    ) {}

    public record WhatIfResult(
            double successProbability,
            double p50Final,
            double p10Final,
            double p90Final
    ) {}

    public WhatIfResult whatIf(WhatIfInput input) {
        double mu    = input.annualReturn() / MONTHS_PER_YEAR;
        double sigma = input.annualVol()    / Math.sqrt(MONTHS_PER_YEAR);
        int    months = Math.max(input.horizonMonths(), 1);

        double[] finalValues = new double[PATHS];
        Random rng = new Random(System.nanoTime());

        for (int p = 0; p < PATHS; p++) {
            double value = input.currentValue();
            for (int m = 0; m < months; m++) {
                double z     = rng.nextGaussian();
                double shock = Math.exp(mu - 0.5 * sigma * sigma + sigma * z);
                value = (value + input.monthlyContribution()) * shock;
                if (value < 0) value = 0;
            }
            finalValues[p] = value;
        }

        Arrays.sort(finalValues);
        long successes = 0;
        for (double v : finalValues) {
            if (v >= input.targetAmount()) successes++;
        }

        return new WhatIfResult(
                (double) successes / PATHS,
                percentile(finalValues, 50),
                percentile(finalValues, 10),
                percentile(finalValues, 90)
        );
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private GoalProjection buildTrivialProjection(FinancialGoal goal,
                                                   double currentValue,
                                                   double targetAmount) {
        double prob = currentValue >= targetAmount ? 1.0 : 0.0;
        BigDecimal cv = bd(currentValue);
        return GoalProjection.builder()
                .goal(goal)
                .successProbability(BigDecimal.valueOf(prob))
                .p10Final(cv).p25Final(cv).p50Final(cv).p75Final(cv).p90Final(cv)
                .yearlyBands("[]")
                .simulationPaths(0)
                .build();
    }

    /** Linear interpolation percentile on a *sorted* array. */
    private double percentile(double[] sorted, int pct) {
        if (sorted.length == 0) return 0;
        double rank = pct / 100.0 * (sorted.length - 1);
        int    lo   = (int) rank;
        int    hi   = Math.min(lo + 1, sorted.length - 1);
        double frac = rank - lo;
        return sorted[lo] + frac * (sorted[hi] - sorted[lo]);
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private BigDecimal bd(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP);
    }
}
