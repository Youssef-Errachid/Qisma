package com.qisma.controller;

import com.qisma.dto.response.MemberResponse;
import com.qisma.enums.MembershipStatus;
import com.qisma.service.GroupLifecycleService;
import com.qisma.service.MemberService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/groups/{groupId}/members")
public class MemberController {

    private final MemberService memberService;
    private final GroupLifecycleService lifecycleService;

    public MemberController(MemberService memberService, GroupLifecycleService lifecycleService) {
        this.memberService = memberService;
        this.lifecycleService = lifecycleService;
    }

    @GetMapping
    public List<MemberResponse> list(@AuthenticationPrincipal Jwt jwt, @PathVariable String groupId,
                                     @RequestParam(required = false) MembershipStatus status) {
        return memberService.list(jwt.getSubject(), groupId, status);
    }

    /** Owner only. The membership is kept (never deleted): it becomes INACTIVE and the history stays attached. */
    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> deactivate(@AuthenticationPrincipal Jwt jwt, @PathVariable String groupId,
                                           @PathVariable String userId) {
        lifecycleService.deactivateMember(jwt.getSubject(), groupId, userId);
        return ResponseEntity.noContent().build();
    }
}
