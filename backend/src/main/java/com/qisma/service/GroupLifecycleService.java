package com.qisma.service;

import com.qisma.dto.request.TransferOwnershipRequest;
import com.qisma.dto.request.UpdateGroupRequest;
import com.qisma.dto.response.GroupResponse;

public interface GroupLifecycleService {

    GroupResponse update(String userId, String groupId, UpdateGroupRequest request);

    /** Read-only from now on. Refused while a settlement is still pending. */
    void archive(String userId, String groupId);

    /** The caller leaves. Requires a zero balance and no pending settlement. */
    void leave(String userId, String groupId);

    /** Owner only. The member may still owe money: it stays settle-only. Refused with a pending settlement. */
    void deactivateMember(String userId, String groupId, String targetUserId);

    GroupResponse transferOwnership(String userId, String groupId, TransferOwnershipRequest request);
}
