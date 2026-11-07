package com.qisma.repository;

import com.qisma.model.ActivityLog;

/** Append-only on purpose: there is no update and no delete for the history. */
public interface ActivityLogStore {

    ActivityLog append(ActivityLog log);
}
