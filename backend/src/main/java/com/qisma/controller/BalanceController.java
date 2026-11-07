package com.qisma.controller;

import com.qisma.dto.response.BalancesResponse;
import com.qisma.dto.response.MemberBalanceResponse;
import com.qisma.service.BalanceService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Read-only: balances are derived data and can only change by changing the expenses behind them. */
@RestController
@RequestMapping("/api/v1/groups/{groupId}/balances")
public class BalanceController {

    private final BalanceService balanceService;

    public BalanceController(BalanceService balanceService) {
        this.balanceService = balanceService;
    }

    @GetMapping
    public BalancesResponse list(@AuthenticationPrincipal Jwt jwt, @PathVariable String groupId) {
        return balanceService.getBalances(jwt.getSubject(), groupId);
    }

    @GetMapping("/{userId}")
    public MemberBalanceResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable String groupId,
                                     @PathVariable String userId) {
        return balanceService.getBalance(jwt.getSubject(), groupId, userId);
    }
}
