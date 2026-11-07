package com.qisma.service;

import com.qisma.dto.request.CreateInvitationRequest;
import com.qisma.dto.response.GroupResponse;
import com.qisma.dto.response.InvitationCreatedResponse;
import com.qisma.dto.response.InvitationPreviewResponse;
import com.qisma.dto.response.InvitationResponse;

import java.util.List;

public interface InvitationService {

    InvitationCreatedResponse create(String userId, String groupId, CreateInvitationRequest request);

    List<InvitationResponse> list(String userId, String groupId);

    void revoke(String userId, String groupId, String invitationId);

    InvitationPreviewResponse preview(String userId, String secret);

    GroupResponse accept(String userId, String secret);
}
