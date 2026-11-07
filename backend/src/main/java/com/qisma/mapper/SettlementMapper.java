package com.qisma.mapper;

import com.qisma.dto.response.SettlementResponse;
import com.qisma.model.Settlement;
import com.qisma.model.User;
import com.qisma.repository.UserRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
public class SettlementMapper {

    static final String UNKNOWN_USER = "Unknown user";

    private final UserRepository users;

    public SettlementMapper(UserRepository users) {
        this.users = users;
    }

    public SettlementResponse toResponse(Settlement s) {
        Map<String, User> byId = users.findAllById(List.of(s.getFromUserId(), s.getToUserId())).stream()
                .collect(Collectors.toMap(User::getId, Function.identity(), (a, b) -> a));
        return new SettlementResponse(
                s.getId(), s.getGroupId(),
                s.getFromUserId(), nameOf(byId, s.getFromUserId()),
                s.getToUserId(), nameOf(byId, s.getToUserId()),
                s.getAmountMinor(), s.getCurrency(), s.getNote(), s.getStatus(),
                s.getCreatedAt(), s.getConfirmedAt(), s.getRejectedAt(), s.getRejectionReason(),
                s.getCancelledAt(), s.getVersion());
    }

    private static String nameOf(Map<String, User> byId, String id) {
        User user = byId.get(id);
        return user != null ? user.getUsername() : UNKNOWN_USER;
    }
}
