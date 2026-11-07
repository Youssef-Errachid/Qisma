package com.qisma.controller;

import com.qisma.dto.request.CreateInvitationRequest;
import com.qisma.dto.response.GroupResponse;
import com.qisma.dto.response.InvitationCreatedResponse;
import com.qisma.dto.response.InvitationPreviewResponse;
import com.qisma.dto.response.InvitationResponse;
import com.qisma.service.InvitationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
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
@RequestMapping("/api/v1")
public class InvitationController {

    private final InvitationService invitationService;

    public InvitationController(InvitationService invitationService) {
        this.invitationService = invitationService;
    }

    @PostMapping("/groups/{groupId}/invitations")
    @ResponseStatus(HttpStatus.CREATED)
    public InvitationCreatedResponse create(@AuthenticationPrincipal Jwt jwt, @PathVariable String groupId,
                                            @Valid @RequestBody CreateInvitationRequest request) {
        return invitationService.create(jwt.getSubject(), groupId, request);
    }

    @GetMapping("/groups/{groupId}/invitations")
    public List<InvitationResponse> list(@AuthenticationPrincipal Jwt jwt, @PathVariable String groupId) {
        return invitationService.list(jwt.getSubject(), groupId);
    }

    @DeleteMapping("/groups/{groupId}/invitations/{invitationId}")
    public ResponseEntity<Void> revoke(@AuthenticationPrincipal Jwt jwt, @PathVariable String groupId,
                                       @PathVariable String invitationId) {
        invitationService.revoke(jwt.getSubject(), groupId, invitationId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/invitations/{secret}")
    public InvitationPreviewResponse preview(@AuthenticationPrincipal Jwt jwt, @PathVariable String secret) {
        return invitationService.preview(jwt.getSubject(), secret);
    }

    @PostMapping("/invitations/{secret}/accept")
    public GroupResponse accept(@AuthenticationPrincipal Jwt jwt, @PathVariable String secret) {
        return invitationService.accept(jwt.getSubject(), secret);
    }
}
