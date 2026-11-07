package com.qisma.service.impl;

import com.qisma.dto.response.MemberResponse;
import com.qisma.enums.GroupRole;
import com.qisma.enums.MembershipStatus;
import com.qisma.model.Membership;
import com.qisma.model.User;
import com.qisma.repository.MembershipRepository;
import com.qisma.repository.UserRepository;
import com.qisma.security.GroupAccessGuard;
import com.qisma.service.MemberService;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class MemberServiceImpl implements MemberService {

    static final String UNKNOWN_USER = "Unknown user";

    private final MembershipRepository memberships;
    private final UserRepository users;
    private final GroupAccessGuard guard;

    public MemberServiceImpl(MembershipRepository memberships, UserRepository users, GroupAccessGuard guard) {
        this.memberships = memberships;
        this.users = users;
        this.guard = guard;
    }

    @Override
    public List<MemberResponse> list(String userId, String groupId, MembershipStatus status) {
        guard.forRead(groupId, userId);

        List<Membership> found = status == null
                ? memberships.findByGroupId(groupId)
                : memberships.findByGroupIdAndStatus(groupId, status);

        Map<String, User> usersById = users.findAllById(found.stream().map(Membership::getUserId).toList())
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));

        return found.stream()
                .sorted(Comparator
                        .comparing((Membership m) -> m.getRole() != GroupRole.OWNER)
                        .thenComparing(Membership::getJoinedAt, Comparator.nullsLast(Comparator.<Instant>naturalOrder()))
                        .thenComparing(Membership::getUserId))
                .map(m -> toResponse(m, usersById.get(m.getUserId())))
                .toList();
    }

    private static MemberResponse toResponse(Membership m, User user) {
        return new MemberResponse(
                m.getUserId(),
                user != null ? user.getUsername() : UNKNOWN_USER,
                user != null ? user.getFullName() : UNKNOWN_USER,
                m.getRole(),
                m.getStatus(),
                m.getJoinedAt());
    }
}
