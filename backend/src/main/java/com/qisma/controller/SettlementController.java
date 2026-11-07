package com.qisma.controller;

import com.qisma.dto.request.CreateSettlementRequest;
import com.qisma.dto.request.RejectSettlementRequest;
import com.qisma.dto.response.PageResponse;
import com.qisma.dto.response.SettlementResponse;
import com.qisma.dto.response.SuggestionsResponse;
import com.qisma.enums.SettlementStatus;
import com.qisma.service.SettlementCommandService;
import com.qisma.service.SettlementQueryService;
import com.qisma.service.SettlementResult;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The caller's identity always comes from the verified token. */
@RestController
@RequestMapping("/api/v1/groups/{groupId}/settlements")
public class SettlementController {

    private final SettlementQueryService queryService;
    private final SettlementCommandService commandService;

    public SettlementController(SettlementQueryService queryService, SettlementCommandService commandService) {
        this.queryService = queryService;
        this.commandService = commandService;
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

    /** 201 for a new settlement, 200 when an Idempotency-Key replay returned the one that already existed. */
    @PostMapping
    public ResponseEntity<SettlementResponse> create(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String groupId,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody CreateSettlementRequest request) {
        SettlementResult result = commandService.create(jwt.getSubject(), groupId, idempotencyKey, request);
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK).body(result.response());
    }

    @PostMapping("/{settlementId}/confirm")
    public SettlementResponse confirm(@AuthenticationPrincipal Jwt jwt, @PathVariable String groupId,
                                      @PathVariable String settlementId) {
        return commandService.confirm(jwt.getSubject(), groupId, settlementId);
    }

    @PostMapping("/{settlementId}/reject")
    public SettlementResponse reject(@AuthenticationPrincipal Jwt jwt, @PathVariable String groupId,
                                     @PathVariable String settlementId,
                                     @Valid @RequestBody(required = false) RejectSettlementRequest request) {
        return commandService.reject(jwt.getSubject(), groupId, settlementId,
                request == null ? null : request.reason());
    }

    @PostMapping("/{settlementId}/cancel")
    public SettlementResponse cancel(@AuthenticationPrincipal Jwt jwt, @PathVariable String groupId,
                                     @PathVariable String settlementId) {
        return commandService.cancel(jwt.getSubject(), groupId, settlementId);
    }
}
