package com.qisma.controller;

import com.qisma.dto.response.MemberResponse;
import com.qisma.enums.MembershipStatus;
import com.qisma.service.MemberService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
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

    public MemberController(MemberService memberService) {
        this.memberService = memberService;
    }

    @GetMapping
    public List<MemberResponse> list(@AuthenticationPrincipal Jwt jwt, @PathVariable String groupId,
                                     @RequestParam(required = false) MembershipStatus status) {
        return memberService.list(jwt.getSubject(), groupId, status);
    }
}
