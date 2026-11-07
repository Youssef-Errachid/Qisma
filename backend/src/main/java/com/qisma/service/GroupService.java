package com.qisma.service;

import com.qisma.dto.request.CreateGroupRequest;
import com.qisma.dto.response.GroupResponse;

import java.util.List;

public interface GroupService {

    GroupResponse create(String userId, CreateGroupRequest request);

    List<GroupResponse> listMine(String userId);

    GroupResponse get(String userId, String groupId);
}
