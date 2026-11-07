package com.qisma.service.impl;

import com.qisma.dto.request.ActivitySearchCriteria;
import com.qisma.dto.response.ActivityResponse;
import com.qisma.dto.response.PageResponse;
import com.qisma.enums.ActivityAction;
import com.qisma.enums.ActivityEntityType;
import com.qisma.enums.GroupRole;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.model.ActivityLog;
import com.qisma.model.Group;
import com.qisma.model.Membership;
import com.qisma.model.User;
import com.qisma.repository.ActivityQueryStore;
import com.qisma.repository.UserRepository;
import com.qisma.security.GroupAccessGuard;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

class ActivityQueryServiceImplTest {

    private static final Instant NOW = Instant.parse("2026-11-07T12:00:00Z");

    private GroupAccessGuard guard;
    private ActivityQueryStore store;
    private UserRepository users;
    private ActivityQueryServiceImpl service;

    @BeforeEach
    void setUp() {
        guard = mock(GroupAccessGuard.class);
        store = mock(ActivityQueryStore.class);
        users = mock(UserRepository.class);
        service = new ActivityQueryServiceImpl(guard, store, users);

        Group group = new Group();
        group.setId("g1");
        when(guard.forRead("g1", "youssef")).thenReturn(new GroupAccessGuard.Access(group,
                new Membership("g1", "youssef", GroupRole.OWNER, NOW)));
        when(store.search(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 20), 0));
    }

    private static ActivitySearchCriteria none() {
        return new ActivitySearchCriteria(null, null, null, null, null, null);
    }

    private static User user(String id) {
        User u = new User();
        u.setId(id);
        u.setUsername(id);
        return u;
    }

    private Pageable pageableSent() {
        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        verify(store).search(eq("g1"), any(), any(), any(), any(), any(), any(), captor.capture());
        return captor.getValue();
    }

    @Test
    void list_mapsTheLines_withActorNamesAndBothValues() {
        ActivityLog log = new ActivityLog("g1", "ahmed", ActivityAction.EXPENSE_UPDATED, "e1",
                Map.of("amountMinor", 100L), Map.of("amountMinor", 200L), NOW);
        when(store.search(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of(log), PageRequest.of(0, 20), 1));
        when(users.findAllById(any())).thenReturn(List.of(user("ahmed")));

        PageResponse<ActivityResponse> r = service.list("youssef", "g1", none(), 0, 20);

        assertEquals(1, r.totalElements());
        ActivityResponse line = r.items().get(0);
        assertEquals(ActivityAction.EXPENSE_UPDATED, line.action());
        assertEquals(ActivityEntityType.EXPENSE, line.entityType());
        assertEquals("ahmed", line.actorUsername());
        assertEquals(100L, line.oldValue().get("amountMinor"));
        assertEquals(200L, line.newValue().get("amountMinor"));
        assertEquals(NOW, line.createdAt());
    }

    @Test
    void list_anUnknownActor_doesNotBreakTheHistory() {
        ActivityLog log = new ActivityLog("g1", "ghost", ActivityAction.EXPENSE_CREATED, "e1", null, Map.of(), NOW);
        when(store.search(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of(log), PageRequest.of(0, 20), 1));
        when(users.findAllById(any())).thenReturn(List.of());

        assertEquals(ActivityQueryServiceImpl.UNKNOWN_USER, service.list("youssef", "g1", none(), 0, 20).items().get(0).actorUsername());
    }

    @Test
    void list_passesTheFiltersToTheStore_blankOnesAsNothing() {
        service.list("youssef", "g1", new ActivitySearchCriteria(" ahmed ", ActivityAction.EXPENSE_DELETED,
                ActivityEntityType.EXPENSE, "  ", null, null), 0, 20);

        verify(store).search(eq("g1"), eq("ahmed"), eq(ActivityAction.EXPENSE_DELETED), eq(ActivityEntityType.EXPENSE),
                isNull(), isNull(), isNull(), any());
    }

    @Test
    void list_theChosenDays_becomeAnInclusiveStartAndAnExclusiveEnd_inUtc() {
        service.list("youssef", "g1", new ActivitySearchCriteria(null, null, null, null,
                LocalDate.parse("2026-10-01"), LocalDate.parse("2026-10-31")), 0, 20);

        ArgumentCaptor<Instant> from = ArgumentCaptor.forClass(Instant.class);
        ArgumentCaptor<Instant> to = ArgumentCaptor.forClass(Instant.class);
        verify(store).search(eq("g1"), any(), any(), any(), any(), from.capture(), to.capture(), any());
        assertEquals(Instant.parse("2026-10-01T00:00:00Z"), from.getValue());
        assertEquals(Instant.parse("2026-11-01T00:00:00Z"), to.getValue(), "the whole of 31 October must be included");
    }

    @Test
    void list_asksForTheNewestFirst_withTheRequestedWindow() {
        service.list("youssef", "g1", none(), 3, 50);

        Pageable pageable = pageableSent();
        assertEquals(3, pageable.getPageNumber());
        assertEquals(50, pageable.getPageSize());
        assertTrue(pageable.getSort().getOrderFor("createdAt").isDescending());
        assertTrue(pageable.getSort().getOrderFor("_id").isDescending());
    }

    @Test
    void list_rejectsInvalidPaginationAndAReversedPeriod() {
        for (int[] bad : new int[][]{{-1, 20}, {0, 0}, {0, ActivityQueryServiceImpl.MAX_PAGE_SIZE + 1}}) {
            assertEquals(ErrorCode.VALIDATION_FAILED, assertThrows(ApiException.class,
                    () -> service.list("youssef", "g1", none(), bad[0], bad[1])).getCode());
        }
        assertEquals(ErrorCode.VALIDATION_FAILED, assertThrows(ApiException.class, () -> service.list("youssef", "g1",
                new ActivitySearchCriteria(null, null, null, null, LocalDate.parse("2026-11-01"), LocalDate.parse("2026-10-01")),
                0, 20)).getCode());
        verify(store, never()).search(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void list_byANonMember_isRefusedBeforeAnythingElse() {
        when(guard.forRead("g1", "stranger")).thenThrow(new ApiException(ErrorCode.NOT_FOUND, "Group not found"));

        assertEquals(ErrorCode.NOT_FOUND, assertThrows(ApiException.class,
                () -> service.list("stranger", "g1", none(), -5, 999)).getCode());
        verifyNoInteractions(store);
    }

    @Test
    void theHistoryStoreOffersNoWayToWrite() {
        for (var method : ActivityQueryStore.class.getMethods()) {
            assertEquals("search", method.getName());
        }
    }
}
