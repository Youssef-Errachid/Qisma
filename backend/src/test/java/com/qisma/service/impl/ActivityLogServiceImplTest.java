package com.qisma.service.impl;

import com.qisma.enums.ActivityAction;
import com.qisma.enums.ActivityEntityType;
import com.qisma.model.ActivityLog;
import com.qisma.repository.ActivityLogStore;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ActivityLogServiceImplTest {

    private static final Instant NOW = Instant.parse("2026-11-07T12:00:00Z");

    @Test
    void record_appendsOneLine_withTheActorTheEntityAndBothValues() {
        ActivityLogStore store = mock(ActivityLogStore.class);
        ActivityLogServiceImpl service = new ActivityLogServiceImpl(store, Clock.fixed(NOW, ZoneOffset.UTC));

        service.record("g1", "youssef", ActivityAction.EXPENSE_UPDATED, "e1",
                Map.of("amountMinor", 100L), Map.of("amountMinor", 200L));

        ArgumentCaptor<ActivityLog> captor = ArgumentCaptor.forClass(ActivityLog.class);
        verify(store).append(captor.capture());
        ActivityLog log = captor.getValue();
        assertEquals("g1", log.getGroupId());
        assertEquals("youssef", log.getActorId());
        assertEquals(ActivityAction.EXPENSE_UPDATED, log.getAction());
        assertEquals(ActivityEntityType.EXPENSE, log.getEntityType());
        assertEquals("e1", log.getEntityId());
        assertEquals(100L, log.getOldValue().get("amountMinor"));
        assertEquals(200L, log.getNewValue().get("amountMinor"));
        assertEquals(NOW, log.getCreatedAt());
    }

    @Test
    void record_acceptsACreationWithoutAnOldValue() {
        ActivityLogStore store = mock(ActivityLogStore.class);
        ActivityLogServiceImpl service = new ActivityLogServiceImpl(store, Clock.fixed(NOW, ZoneOffset.UTC));

        service.record("g1", "youssef", ActivityAction.EXPENSE_CREATED, "e1", null, Map.of("title", "x"));

        ArgumentCaptor<ActivityLog> captor = ArgumentCaptor.forClass(ActivityLog.class);
        verify(store).append(captor.capture());
        assertNull(captor.getValue().getOldValue());
    }

    @Test
    void theStoreInterfaceOffersNoWayToChangeOrRemoveHistory() {
        for (var method : ActivityLogStore.class.getMethods()) {
            assertEquals("append", method.getName());
        }
    }
}
