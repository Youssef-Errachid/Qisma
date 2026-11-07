package com.qisma.enums;

public enum ActivityAction {
    EXPENSE_CREATED(ActivityEntityType.EXPENSE),
    EXPENSE_UPDATED(ActivityEntityType.EXPENSE),
    EXPENSE_DELETED(ActivityEntityType.EXPENSE);

    private final ActivityEntityType entityType;

    ActivityAction(ActivityEntityType entityType) {
        this.entityType = entityType;
    }

    public ActivityEntityType entityType() {
        return entityType;
    }
}
