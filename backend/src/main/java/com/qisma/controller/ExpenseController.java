package com.qisma.controller;

import com.qisma.dto.request.CreateExpenseRequest;
import com.qisma.dto.request.ExpenseSearchCriteria;
import com.qisma.dto.request.UpdateExpenseRequest;
import com.qisma.dto.response.ExpenseResponse;
import com.qisma.dto.response.PageResponse;
import com.qisma.enums.ExpenseCategory;
import com.qisma.service.ExpenseQueryService;
import com.qisma.service.ExpenseService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/** The caller's identity always comes from the verified token. */
@RestController
@RequestMapping("/api/v1/groups/{groupId}/expenses")
public class ExpenseController {

    private final ExpenseService expenseService;
    private final ExpenseQueryService queryService;

    public ExpenseController(ExpenseService expenseService, ExpenseQueryService queryService) {
        this.expenseService = expenseService;
        this.queryService = queryService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ExpenseResponse create(@AuthenticationPrincipal Jwt jwt, @PathVariable String groupId,
                                  @Valid @RequestBody CreateExpenseRequest request) {
        return expenseService.create(jwt.getSubject(), groupId, request);
    }

    @GetMapping
    public PageResponse<ExpenseResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String groupId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) ExpenseCategory category,
            @RequestParam(required = false) String paidBy,
            @RequestParam(required = false) String participant,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return queryService.list(jwt.getSubject(), groupId,
                new ExpenseSearchCriteria(from, to, category, paidBy, participant, q), page, size);
    }

    @GetMapping("/{expenseId}")
    public ExpenseResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable String groupId,
                               @PathVariable String expenseId) {
        return queryService.get(jwt.getSubject(), groupId, expenseId);
    }

    @PutMapping("/{expenseId}")
    public ExpenseResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable String groupId,
                                  @PathVariable String expenseId,
                                  @Valid @RequestBody UpdateExpenseRequest request) {
        return expenseService.update(jwt.getSubject(), groupId, expenseId, request);
    }

    @DeleteMapping("/{expenseId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable String groupId,
                                       @PathVariable String expenseId) {
        expenseService.delete(jwt.getSubject(), groupId, expenseId);
        return ResponseEntity.noContent().build();
    }
}
