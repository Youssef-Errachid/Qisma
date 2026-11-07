package com.qisma.controller;

import com.qisma.dto.request.CreateGroupRequest;
import com.qisma.dto.response.GroupResponse;
import com.qisma.service.GroupService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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

    public GroupController(GroupService groupService) {
        this.groupService = groupService;
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
}
