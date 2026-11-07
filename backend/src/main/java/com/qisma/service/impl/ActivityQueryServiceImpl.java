package com.qisma.service.impl;

import com.qisma.dto.request.ActivitySearchCriteria;
import com.qisma.dto.response.ActivityResponse;
import com.qisma.dto.response.PageResponse;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.model.ActivityLog;
import com.qisma.model.User;
import com.qisma.repository.ActivityQueryStore;
import com.qisma.repository.UserRepository;
import com.qisma.security.GroupAccessGuard;
import com.qisma.service.ActivityQueryService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ActivityQueryServiceImpl implements ActivityQueryService {

    static final int MAX_PAGE_SIZE = 100;
    static final String UNKNOWN_USER = "Unknown user";
    /** Newest first; the id makes the order fully deterministic between pages. */
    static final Sort NEWEST_FIRST = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("_id"));

    private final GroupAccessGuard guard;
    private final ActivityQueryStore store;
    private final UserRepository users;

    public ActivityQueryServiceImpl(GroupAccessGuard guard, ActivityQueryStore store, UserRepository users) {
        this.guard = guard;
        this.store = store;
        this.users = users;
    }

    @Override
    public PageResponse<ActivityResponse> list(String userId, String groupId, ActivitySearchCriteria criteria,
                                               int page, int size) {
        guard.forRead(groupId, userId);
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED,
                    "Invalid pagination: page must be >= 0 and size between 1 and " + MAX_PAGE_SIZE);
        }
        if (criteria.from() != null && criteria.to() != null && criteria.from().isAfter(criteria.to())) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "'from' must not be after 'to'");
        }

        // whole UTC days: the start of 'from' up to (not including) the day after 'to'
        Instant from = criteria.from() == null ? null : criteria.from().atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant toExclusive = criteria.to() == null ? null : startOfNextDay(criteria.to());

        Page<ActivityLog> result = store.search(groupId, blankToNull(criteria.actorId()), criteria.action(),
                criteria.entityType(), blankToNull(criteria.entityId()), from, toExclusive,
                PageRequest.of(page, size, NEWEST_FIRST));

        Set<String> actorIds = new HashSet<>();
        result.getContent().forEach(log -> actorIds.add(log.getActorId()));
        Map<String, User> actors = actorIds.isEmpty() ? Map.of()
                : users.findAllById(actorIds).stream().collect(Collectors.toMap(User::getId, Function.identity(), (a, b) -> a));

        return new PageResponse<>(result.getContent().stream().map(log -> toResponse(log, actors)).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    private static Instant startOfNextDay(LocalDate day) {
        return day.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    private static ActivityResponse toResponse(ActivityLog log, Map<String, User> actors) {
        User actor = actors.get(log.getActorId());
        return new ActivityResponse(log.getId(), log.getAction(), log.getEntityType(), log.getEntityId(),
                log.getActorId(), actor != null ? actor.getUsername() : UNKNOWN_USER,
                log.getCreatedAt(), log.getOldValue(), log.getNewValue());
    }

    private static String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }
}
