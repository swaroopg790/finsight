package com.finsight.portfolio.domain.service;

import com.finsight.portfolio.api.dto.response.AccountResponse;
import com.finsight.portfolio.api.dto.response.HoldingResponse;
import com.finsight.portfolio.domain.model.Position;
import com.finsight.portfolio.domain.repository.AccountRepository;
import com.finsight.portfolio.domain.repository.PositionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PortfolioService {

    private final PositionRepository positionRepository;
    private final AccountRepository accountRepository;

    @Transactional(readOnly = true)
    public List<HoldingResponse> getHoldings(UUID userId) {
        return positionRepository.findAllByUserId(userId).stream()
                .map(this::toHoldingResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AccountResponse> getAccounts(UUID userId) {
        return accountRepository.findByPlaidItemUserId(userId).stream()
                .map(account -> new AccountResponse(
                        account.getId(),
                        account.getName(),
                        account.getType(),
                        account.getSubtype(),
                        account.getBalanceCurrent(),
                        account.getBalanceAvailable(),
                        account.getCurrency(),
                        account.getPlaidItem().getInstitutionName()
                ))
                .toList();
    }

    private HoldingResponse toHoldingResponse(Position p) {
        BigDecimal gainLoss = null;
        BigDecimal gainLossPct = null;
        if (p.getCurrentValue() != null && p.getCostBasis() != null && p.getCostBasis().compareTo(BigDecimal.ZERO) != 0) {
            gainLoss = p.getCurrentValue().subtract(p.getCostBasis());
            gainLossPct = gainLoss.divide(p.getCostBasis(), 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100));
        }
        return new HoldingResponse(
                p.getId(),
                p.getTicker(),
                p.getName(),
                p.getQuantity(),
                p.getCostBasis(),
                p.getCurrentPrice(),
                p.getCurrentValue(),
                gainLoss,
                gainLossPct,
                p.getAccount().getName()
        );
    }
}
