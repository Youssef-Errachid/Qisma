package com.qisma.controller;

import com.qisma.dto.request.CreateGroupRequest;
import com.qisma.dto.request.TransferOwnershipRequest;
import com.qisma.dto.request.UpdateGroupRequest;
import com.qisma.dto.response.GroupResponse;
import com.qisma.service.GroupLifecycleService;
import com.qisma.service.GroupService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** The caller's identity always comes from the verified token. */
@RestController
@RequestMapping("/api/v1/groups")
public class GroupController {

    private final GroupService groupService;
    private final GroupLifecycleService lifecycleService;

    public GroupController(GroupService groupService, GroupLifecycleService lifecycleService) {
        this.groupService = groupService;
        this.lifecycleService = lifecycleService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public GroupResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CreateGroupRequest request) {
        return groupService.create(jwt.getSubject(), request);
    }

    @GetMapping
    public List<GroupResponse> listMine(@AuthenticationPrincipal Jwt jwt) {
        return groupService.listMine(jwt.getSubject());
    }

    @GetMapping("/{groupId}")
    public GroupResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable String groupId) {
        return groupService.get(jwt.getSubject(), groupId);
    }

    @PutMapping("/{groupId}")
    public GroupResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable String groupId,
                                @Valid @RequestBody UpdateGroupRequest request) {
        return lifecycleService.update(jwt.getSubject(), groupId, request);
    }

    /** Archives the group (it becomes read-only). Nothing is ever deleted. */
    @DeleteMapping("/{groupId}")
    public ResponseEntity<Void> archive(@AuthenticationPrincipal Jwt jwt, @PathVariable String groupId) {
        lifecycleService.archive(jwt.getSubject(), groupId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{groupId}/leave")
    public ResponseEntity<Void> leave(@AuthenticationPrincipal Jwt jwt, @PathVariable String groupId) {
        lifecycleService.leave(jwt.getSubject(), groupId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{groupId}/transfer-ownership")
    public GroupResponse transferOwnership(@AuthenticationPrincipal Jwt jwt, @PathVariable String groupId,
                                           @Valid @RequestBody TransferOwnershipRequest request) {
        return lifecycleService.transferOwnership(jwt.getSubject(), groupId, request);
    }
}
