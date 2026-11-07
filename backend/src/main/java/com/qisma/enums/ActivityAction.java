package com.qisma.enums;

public enum ActivityAction {
    EXPENSE_CREATED(ActivityEntityType.EXPENSE),
    EXPENSE_UPDATED(ActivityEntityType.EXPENSE),
    EXPENSE_DELETED(ActivityEntityType.EXPENSE),
    SETTLEMENT_CREATED(ActivityEntityType.SETTLEMENT),
    SETTLEMENT_CONFIRMED(ActivityEntityType.SETTLEMENT),
    SETTLEMENT_REJECTED(ActivityEntityType.SETTLEMENT),
    SETTLEMENT_CANCELLED(ActivityEntityType.SETTLEMENT),
    GROUP_UPDATED(ActivityEntityType.GROUP),
    GROUP_ARCHIVED(ActivityEntityType.GROUP),
    OWNERSHIP_TRANSFERRED(ActivityEntityType.GROUP),
    MEMBER_LEFT(ActivityEntityType.MEMBERSHIP),
    MEMBER_DEACTIVATED(ActivityEntityType.MEMBERSHIP);

    private final ActivityEntityType entityType;

    ActivityAction(ActivityEntityType entityType) {
        this.entityType = entityType;
    }

    public ActivityEntityType entityType() {
        return entityType;
    }
}
