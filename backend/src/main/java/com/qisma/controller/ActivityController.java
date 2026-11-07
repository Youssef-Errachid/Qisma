package com.qisma.controller;

import com.qisma.dto.request.ActivitySearchCriteria;
import com.qisma.dto.response.ActivityResponse;
import com.qisma.dto.response.PageResponse;
import com.qisma.enums.ActivityAction;
import com.qisma.enums.ActivityEntityType;
import com.qisma.service.ActivityQueryService;
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
@RequestMapping("/api/v1/groups/{groupId}/activity")
public class ActivityController {

    private final ActivityQueryService queryService;

    public ActivityController(ActivityQueryService queryService) {
        this.queryService = queryService;
    }

    @GetMapping
    public PageResponse<ActivityResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String groupId,
            @RequestParam(required = false) String actorId,
            @RequestParam(required = false) ActivityAction action,
            @RequestParam(required = false) ActivityEntityType entityType,
            @RequestParam(required = false) String entityId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return queryService.list(jwt.getSubject(), groupId,
                new ActivitySearchCriteria(actorId, action, entityType, entityId, from, to), page, size);
    }
}
