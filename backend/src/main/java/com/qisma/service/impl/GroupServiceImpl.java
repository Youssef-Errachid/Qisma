package com.qisma.service.impl;

import com.qisma.dto.request.CreateGroupRequest;
import com.qisma.dto.response.GroupResponse;
import com.qisma.enums.GroupRole;
import com.qisma.enums.MembershipStatus;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.mapper.GroupMapper;
import com.qisma.model.Group;
import com.qisma.model.Membership;
import com.qisma.repository.GroupRepository;
import com.qisma.repository.MembershipRepository;
import com.qisma.security.GroupAccessGuard;
import com.qisma.service.GroupService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.Comparator;
import java.util.Currency;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class GroupServiceImpl implements GroupService {

    static final int MAX_GROUPS_PER_USER = 50;
    static final String DEFAULT_CURRENCY = "MAD";

    private final GroupRepository groups;
    private final MembershipRepository memberships;
    private final GroupAccessGuard guard;
    private final GroupMapper mapper;
    private final Clock clock;

    public GroupServiceImpl(GroupRepository groups, MembershipRepository memberships,
                            GroupAccessGuard guard, GroupMapper mapper, Clock clock) {
        this.groups = groups;
        this.memberships = memberships;
        this.guard = guard;
        this.mapper = mapper;
        this.clock = clock;
    }

    /** One transaction: a group never exists without its owner membership. */
    @Override
    @Transactional
    public GroupResponse create(String userId, CreateGroupRequest request) {
        if (memberships.countByUserIdAndStatus(userId, MembershipStatus.ACTIVE) >= MAX_GROUPS_PER_USER) {
            throw new ApiException(ErrorCode.LIMIT_REACHED,
                    "You cannot belong to more than " + MAX_GROUPS_PER_USER + " groups");
        }

        Group group = new Group();
        group.setName(request.name().trim());
        group.setDescription(blankToNull(request.description()));
        group.setOwnerId(userId);
        group.setCurrency(resolveCurrency(request.currency()));
        Group saved = groups.save(group);

        memberships.save(new Membership(saved.getId(), userId, GroupRole.OWNER, clock.instant()));
        return mapper.toResponse(saved, GroupRole.OWNER);
    }

    @Override
    public List<GroupResponse> listMine(String userId) {
        List<Membership> mine = memberships.findByUserIdAndStatus(userId, MembershipStatus.ACTIVE);
        Map<String, GroupRole> roles = new HashMap<>();
        for (Membership m : mine) {
            roles.put(m.getGroupId(), m.getRole());
        }

        return groups.findAllById(roles.keySet()).stream()
                .map(g -> mapper.toResponse(g, roles.get(g.getId())))
                .sorted(Comparator.comparing(GroupResponse::createdAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    @Override
    public GroupResponse get(String userId, String groupId) {
        GroupAccessGuard.Access access = guard.forRead(groupId, userId);
        return mapper.toResponse(access.group(), access.membership().getRole());
    }

    private static String resolveCurrency(String requested) {
        if (requested == null || requested.isBlank()) {
            return DEFAULT_CURRENCY;
        }
        String code = requested.trim().toUpperCase(Locale.ROOT);
        try {
            Currency currency = Currency.getInstance(code);
            if (currency.getDefaultFractionDigits() < 0) {
                throw new IllegalArgumentException("not a monetary currency");
            }
            return currency.getCurrencyCode();
        } catch (IllegalArgumentException e) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Unsupported currency: " + code);
        }
    }

    private static String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }
}
