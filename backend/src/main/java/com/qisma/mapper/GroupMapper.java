package com.qisma.mapper;

import com.qisma.dto.response.GroupResponse;
import com.qisma.enums.GroupRole;
import com.qisma.model.Group;
import org.springframework.stereotype.Component;

@Component
public class GroupMapper {

    public GroupResponse toResponse(Group group, GroupRole myRole) {
        return new GroupResponse(
                group.getId(),
                group.getName(),
                group.getDescription(),
                group.getCurrency(),
                group.getStatus(),
                group.getOwnerId(),
                myRole,
                group.getCreatedAt());
    }
}
