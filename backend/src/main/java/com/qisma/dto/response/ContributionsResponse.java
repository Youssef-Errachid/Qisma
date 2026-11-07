package com.qisma.dto.response;

import java.time.LocalDate;
import java.util.List;

public record ContributionsResponse(String currency, LocalDate from, LocalDate to, List<MemberContribution> members) {

    public record MemberContribution(String userId, String username, String fullName, long paidMinor, long shareMinor) {
    }
}
