package com.finsight.portfolio.domain.service;

import com.finsight.portfolio.api.dto.request.CreateGoalRequest;
import com.finsight.portfolio.api.dto.request.UpdateGoalRequest;
import com.finsight.portfolio.api.dto.request.WhatIfRequest;
import com.finsight.portfolio.api.dto.response.GoalProjectionResponse;
import com.finsight.portfolio.api.dto.response.GoalResponse;
import com.finsight.portfolio.api.dto.response.ParseGoalResponse;
import com.finsight.portfolio.api.dto.response.WhatIfResponse;
import com.finsight.portfolio.domain.model.FinancialGoal;
import com.finsight.portfolio.domain.model.GoalProjection;
import com.finsight.portfolio.domain.model.GoalType;
import com.finsight.portfolio.domain.model.User;
import com.finsight.portfolio.domain.repository.FinancialGoalRepository;
import com.finsight.portfolio.domain.repository.GoalProjectionRepository;
import com.finsight.portfolio.domain.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.springframework.http.HttpStatus.NOT_FOUND;

@Slf4j
@Service
@RequiredArgsConstructor
public class GoalService {

    private final FinancialGoalRepository goalRepository;
    private final GoalProjectionRepository projectionRepository;
    private final UserRepository           userRepository;
    private final MonteCarloService        monteCarloService;
    private final GoalNlpParser            nlpParser;

    // ── List ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<GoalResponse> listGoals(UUID userId) {
        return goalRepository.findByUserIdOrderByCreatedAtAsc(userId)
                .stream()
                .map(g -> toResponse(g, projectionRepository.findByGoalId(g.getId()).orElse(null)))
                .toList();
    }

    // ── Create ────────────────────────────────────────────────────────────────

    @Transactional
    public GoalResponse createGoal(UUID userId, CreateGoalRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "User not found"));

        GoalType goalType = parseGoalType(req.goalType());

        FinancialGoal goal = FinancialGoal.builder()
                .user(user)
                .name(req.name())
                .goalType(goalType)
                .targetAmount(req.targetAmount())
                .targetDate(req.targetDate())
                .currentValue(orZero(req.currentValue()))
                .monthlyContribution(orZero(req.monthlyContribution()))
                .expectedReturnPct(req.expectedReturnPct() != null
                        ? req.expectedReturnPct()
                        : BigDecimal.valueOf(goalType.defaultReturnPct()))
                .volatilityPct(req.volatilityPct() != null
                        ? req.volatilityPct()
                        : BigDecimal.valueOf(goalType.defaultVolatilityPct()))
                .notes(req.notes())
                .build();

        goal = goalRepository.save(goal);

        // Run simulation immediately
        GoalProjection projection = monteCarloService.simulate(goal);
        projection = projectionRepository.save(projection);

        log.info("Created goal={} for user={}, success={}%",
                goal.getId(), userId,
                String.format("%.1f", projection.getSuccessProbability().doubleValue() * 100));

        return toResponse(goal, projection);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    @Transactional
    public GoalResponse updateGoal(UUID userId, UUID goalId, UpdateGoalRequest req) {
        FinancialGoal goal = goalRepository.findByIdAndUserId(goalId, userId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Goal not found"));

        if (req.name()               != null) goal.setName(req.name());
        if (req.targetAmount()       != null) goal.setTargetAmount(req.targetAmount());
        if (req.targetDate()         != null) goal.setTargetDate(req.targetDate());
        if (req.currentValue()       != null) goal.setCurrentValue(req.currentValue());
        if (req.monthlyContribution() != null) goal.setMonthlyContribution(req.monthlyContribution());
        if (req.expectedReturnPct()  != null) goal.setExpectedReturnPct(req.expectedReturnPct());
        if (req.volatilityPct()      != null) goal.setVolatilityPct(req.volatilityPct());
        if (req.notes()              != null) goal.setNotes(req.notes());

        goal = goalRepository.save(goal);

        // Invalidate + recompute projection
        projectionRepository.deleteByGoalId(goalId);
        GoalProjection projection = monteCarloService.simulate(goal);
        projection = projectionRepository.save(projection);

        return toResponse(goal, projection);
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    @Transactional
    public void deleteGoal(UUID userId, UUID goalId) {
        if (!goalRepository.existsByIdAndUserId(goalId, userId)) {
            throw new ResponseStatusException(NOT_FOUND, "Goal not found");
        }
        goalRepository.deleteById(goalId); // cascade deletes projection
    }

    // ── Simulation ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public GoalProjectionResponse getSimulation(UUID userId, UUID goalId) {
        FinancialGoal goal = goalRepository.findByIdAndUserId(goalId, userId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Goal not found"));

        GoalProjection proj = projectionRepository.findByGoalId(goalId)
                .orElseGet(() -> monteCarloService.simulate(goal));

        return toProjectionResponse(proj);
    }

    // ── What-If ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public WhatIfResponse whatIf(UUID userId, UUID goalId, WhatIfRequest req) {
        FinancialGoal goal = goalRepository.findByIdAndUserId(goalId, userId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Goal not found"));

        long horizonMonths = ChronoUnit.MONTHS.between(LocalDate.now(), goal.getTargetDate());

        MonteCarloService.WhatIfInput input = new MonteCarloService.WhatIfInput(
                req.currentValue()       != null ? req.currentValue().doubleValue()       : goal.getCurrentValue().doubleValue(),
                req.monthlyContribution() != null ? req.monthlyContribution().doubleValue() : goal.getMonthlyContribution().doubleValue(),
                req.expectedReturnPct()  != null ? req.expectedReturnPct().doubleValue()  : goal.getExpectedReturnPct().doubleValue(),
                req.volatilityPct()      != null ? req.volatilityPct().doubleValue()      : goal.getVolatilityPct().doubleValue(),
                goal.getTargetAmount().doubleValue(),
                (int) horizonMonths
        );

        MonteCarloService.WhatIfResult result = monteCarloService.whatIf(input);

        // Also run baseline for comparison
        MonteCarloService.WhatIfInput baseline = new MonteCarloService.WhatIfInput(
                goal.getCurrentValue().doubleValue(),
                goal.getMonthlyContribution().doubleValue(),
                goal.getExpectedReturnPct().doubleValue(),
                goal.getVolatilityPct().doubleValue(),
                goal.getTargetAmount().doubleValue(),
                (int) horizonMonths
        );
        MonteCarloService.WhatIfResult baseResult = monteCarloService.whatIf(baseline);

        return new WhatIfResponse(
                round(result.successProbability()),
                round(baseResult.successProbability()),
                round(result.successProbability() - baseResult.successProbability()),
                bd(result.p50Final()),
                bd(result.p10Final()),
                bd(result.p90Final())
        );
    }

    // ── NLP parse ─────────────────────────────────────────────────────────────

    public ParseGoalResponse parseGoal(String text) {
        Optional<GoalNlpParser.ParsedGoal> parsed = nlpParser.parse(text);
        if (parsed.isEmpty()) {
            return new ParseGoalResponse(false, null, null, null, null, null, null, null);
        }
        GoalNlpParser.ParsedGoal p = parsed.get();
        GoalType gt = p.goalType();
        return new ParseGoalResponse(
                true,
                p.name(),
                gt.name(),
                gt.label(),
                gt.emoji(),
                p.targetAmount(),
                p.targetDate(),
                p.monthlyContribution()
        );
    }

    // ── Mapping helpers ───────────────────────────────────────────────────────

    private GoalResponse toResponse(FinancialGoal g, GoalProjection proj) {
        LocalDate today     = LocalDate.now();
        long      daysLeft  = ChronoUnit.DAYS.between(today, g.getTargetDate());
        long      yearsLeft = Math.max(0, daysLeft / 365);

        BigDecimal progress = BigDecimal.ZERO;
        if (g.getTargetAmount().compareTo(BigDecimal.ZERO) > 0) {
            progress = g.getCurrentValue()
                        .divide(g.getTargetAmount(), 4, RoundingMode.HALF_UP)
                        .min(BigDecimal.ONE);
        }

        GoalProjectionResponse projResp = proj != null ? toProjectionResponse(proj) : null;

        return new GoalResponse(
                g.getId(),
                g.getName(),
                g.getGoalType().name(),
                g.getGoalType().label(),
                g.getGoalType().emoji(),
                g.getTargetAmount(),
                g.getTargetDate(),
                g.getCurrentValue(),
                g.getMonthlyContribution(),
                g.getExpectedReturnPct(),
                g.getVolatilityPct(),
                g.getNotes(),
                progress,
                yearsLeft,
                daysLeft,
                projResp,
                g.getCreatedAt()
        );
    }

    private GoalProjectionResponse toProjectionResponse(GoalProjection proj) {
        return new GoalProjectionResponse(
                proj.getSuccessProbability(),
                proj.getP10Final(),
                proj.getP25Final(),
                proj.getP50Final(),
                proj.getP75Final(),
                proj.getP90Final(),
                proj.getYearlyBands(),
                proj.getSimulationPaths(),
                proj.getComputedAt()
        );
    }

    private GoalType parseGoalType(String s) {
        if (s == null || s.isBlank()) return GoalType.CUSTOM;
        try {
            return GoalType.valueOf(s.toUpperCase());
        } catch (IllegalArgumentException e) {
            return GoalType.CUSTOM;
        }
    }

    private BigDecimal orZero(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    private double round(double v) {
        return Math.round(v * 10000.0) / 10000.0;
    }

    private BigDecimal bd(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP);
    }
}
