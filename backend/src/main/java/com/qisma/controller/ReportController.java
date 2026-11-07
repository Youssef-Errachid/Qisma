package com.qisma.controller;

import com.qisma.dto.response.CategoryReportResponse;
import com.qisma.dto.response.ContributionsResponse;
import com.qisma.dto.response.MonthlyReportResponse;
import com.qisma.dto.response.ReportSummaryResponse;
import com.qisma.service.ReportService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/** The caller's identity always comes from the verified token. */
@RestController
@RequestMapping("/api/v1/groups/{groupId}/reports")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/summary")
    public ReportSummaryResponse summary(@AuthenticationPrincipal Jwt jwt, @PathVariable String groupId) {
        return reportService.summary(jwt.getSubject(), groupId);
    }

    @GetMapping("/monthly")
    public MonthlyReportResponse monthly(@AuthenticationPrincipal Jwt jwt, @PathVariable String groupId,
                                         @RequestParam(required = false) String from,
                                         @RequestParam(required = false) String to) {
        return reportService.monthly(jwt.getSubject(), groupId, from, to);
    }

    @GetMapping("/categories")
    public CategoryReportResponse categories(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String groupId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return reportService.categories(jwt.getSubject(), groupId, from, to);
    }

    @GetMapping("/contributions")
    public ContributionsResponse contributions(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String groupId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return reportService.contributions(jwt.getSubject(), groupId, from, to);
    }
}
