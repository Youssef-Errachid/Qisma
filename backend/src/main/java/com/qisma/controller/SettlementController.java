package com.qisma.controller;

import com.qisma.dto.response.PageResponse;
import com.qisma.dto.response.SettlementResponse;
import com.qisma.dto.response.SuggestionsResponse;
import com.qisma.enums.SettlementStatus;
import com.qisma.service.SettlementQueryService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The caller's identity always comes from the verified token. */
@RestController
@RequestMapping("/api/v1/groups/{groupId}/settlements")
public class SettlementController {

    private final SettlementQueryService queryService;

    public SettlementController(SettlementQueryService queryService) {
        this.queryService = queryService;
    }

    @GetMapping
    public PageResponse<SettlementResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String groupId,
            @RequestParam(required = false) SettlementStatus status,
            @RequestParam(required = false) String userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return queryService.list(jwt.getSubject(), groupId, status, userId, page, size);
    }

    @GetMapping("/suggestions")
    public SuggestionsResponse suggestions(@AuthenticationPrincipal Jwt jwt, @PathVariable String groupId) {
        return queryService.suggestions(jwt.getSubject(), groupId);
    }
}
