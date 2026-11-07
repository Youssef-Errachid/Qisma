package com.qisma.service.impl;

import com.qisma.dto.response.BalancesResponse;
import com.qisma.dto.response.MemberBalanceResponse;
import com.qisma.enums.ExpenseStatus;
import com.qisma.enums.GroupRole;
import com.qisma.enums.MembershipStatus;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.model.Expense;
import com.qisma.model.ExpenseShare;
import com.qisma.model.Group;
import com.qisma.model.Membership;
import com.qisma.model.User;
import com.qisma.repository.ExpenseRepository;
import com.qisma.repository.MembershipRepository;
import com.qisma.repository.UserRepository;
import com.qisma.security.GroupAccessGuard;
import com.qisma.service.finance.BalanceCalculator;
import com.qisma.service.finance.LedgerInvariantViolation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class BalanceServiceImplTest {

    private static final Instant T0 = Instant.parse("2026-11-01T10:00:00Z");

    private ExpenseRepository expenses;
    private MembershipRepository memberships;
    private UserRepository users;
    private GroupAccessGuard guard;
    private BalanceServiceImpl service;

    @BeforeEach
    void setUp() {
        expenses = mock(ExpenseRepository.class);
        memberships = mock(MembershipRepository.class);
        users = mock(UserRepository.class);
        guard = mock(GroupAccessGuard.class);
        service = new BalanceServiceImpl(expenses, memberships, users, guard, new BalanceCalculator());

        Group group = new Group();
        group.setId("g1");
        group.setCurrency("MAD");
        when(guard.forRead("g1", "youssef")).thenReturn(new GroupAccessGuard.Access(group,
                new Membership("g1", "youssef", GroupRole.OWNER, T0)));

        when(memberships.findByGroupId("g1")).thenReturn(List.of(
                new Membership("g1", "youssef", GroupRole.OWNER, T0),
                new Membership("g1", "ahmed", GroupRole.MEMBER, T0.plusSeconds(10)),
                new Membership("g1", "hamza", GroupRole.MEMBER, T0.plusSeconds(20))));
        when(users.findAllById(any())).thenReturn(List.of(
                user("youssef", "Youssef"), user("ahmed", "Ahmed"), user("hamza", "Hamza")));
    }

    private static User user(String id, String fullName) {
        User u = new User();
        u.setId(id);
        u.setUsername(id);
        u.setFullName(fullName);
        u.setEmail(id + "@secret.com");
        return u;
    }

    private static Expense expense(String paidBy, long amount, ExpenseShare... shares) {
        Expense e = new Expense();
        e.setGroupId("g1");
        e.setPaidBy(paidBy);
        e.setAmountMinor(amount);
        e.setStatus(ExpenseStatus.ACTIVE);
        e.setShares(List.of(shares));
        return e;
    }

    private static ExpenseShare share(String userId, long amount) {
        return new ExpenseShare(userId, amount, null);
    }

    /** The three expenses of cahier section 8.2, shares as the equal split really produces them. */
    private void cahierExpenses() {
        when(expenses.findByGroupIdAndStatus("g1", ExpenseStatus.ACTIVE)).thenReturn(List.of(
                expense("youssef", 30000, share("youssef", 10000), share("ahmed", 10000), share("hamza", 10000)),
                expense("ahmed", 15000, share("youssef", 5000), share("ahmed", 5000), share("hamza", 5000)),
                expense("hamza", 20000, share("youssef", 6667), share("ahmed", 6667), share("hamza", 6666))));
    }

    private static Map<String, MemberBalanceResponse> byUser(BalancesResponse r) {
        return r.members().stream().collect(Collectors.toMap(MemberBalanceResponse::userId, Function.identity()));
    }

    @Test
    void cahierExample_withTheCorrectedNumbers() {
        cahierExpenses();

        BalancesResponse r = service.getBalances("youssef", "g1");
        Map<String, MemberBalanceResponse> b = byUser(r);

        assertEquals("MAD", r.currency());
        assertEquals(30000L, b.get("youssef").paidMinor());
        assertEquals(21667L, b.get("youssef").shareMinor());
        assertEquals(8333L, b.get("youssef").netMinor());
        assertEquals(-6667L, b.get("ahmed").netMinor());
        // the cahier prints -66.66 for Hamza, which would break the zero sum; the correct value is -16.66
        assertEquals(-1666L, b.get("hamza").netMinor());
        assertEquals(0L, r.sumMinor());
    }

    @Test
    void theSumOfAllNetBalancesIsAlwaysZero() {
        cahierExpenses();
        assertEquals(0L, service.getBalances("youssef", "g1").members().stream()
                .mapToLong(MemberBalanceResponse::netMinor).sum());
    }

    @Test
    void onlyActiveExpensesAreRead() {
        cahierExpenses();
        service.getBalances("youssef", "g1");
        verify(expenses).findByGroupIdAndStatus("g1", ExpenseStatus.ACTIVE);
        verify(expenses, never()).findAll();
    }

    @Test
    void aGroupWithoutExpenses_hasEveryoneAtZero() {
        when(expenses.findByGroupIdAndStatus("g1", ExpenseStatus.ACTIVE)).thenReturn(List.of());

        BalancesResponse r = service.getBalances("youssef", "g1");

        assertEquals(3, r.members().size());
        r.members().forEach(m -> assertEquals(0L, m.netMinor()));
    }

    @Test
    void membersAreListedOwnerFirst_thenByJoinDate() {
        when(expenses.findByGroupIdAndStatus("g1", ExpenseStatus.ACTIVE)).thenReturn(List.of());
        assertEquals(List.of("youssef", "ahmed", "hamza"),
                service.getBalances("youssef", "g1").members().stream().map(MemberBalanceResponse::userId).toList());
    }

    @Test
    void aMemberWhoLeft_keepsTheirBalance() {
        Membership gone = new Membership("g1", "hamza", GroupRole.MEMBER, T0.plusSeconds(20));
        gone.setStatus(MembershipStatus.INACTIVE);
        when(memberships.findByGroupId("g1")).thenReturn(List.of(
                new Membership("g1", "youssef", GroupRole.OWNER, T0), gone));
        when(expenses.findByGroupIdAndStatus("g1", ExpenseStatus.ACTIVE)).thenReturn(List.of(
                expense("hamza", 3000, share("youssef", 1500), share("hamza", 1500))));

        BalancesResponse r = service.getBalances("youssef", "g1");

        MemberBalanceResponse hamza = byUser(r).get("hamza");
        assertEquals(MembershipStatus.INACTIVE, hamza.membershipStatus());
        assertEquals(1500L, hamza.netMinor());
        assertEquals(-1500L, byUser(r).get("youssef").netMinor());
        assertEquals(0L, r.sumMinor());
    }

    @Test
    void anUnknownUser_doesNotBreakTheBalances() {
        when(users.findAllById(any())).thenReturn(List.of(user("youssef", "Youssef")));
        when(expenses.findByGroupIdAndStatus("g1", ExpenseStatus.ACTIVE)).thenReturn(List.of());

        assertEquals(BalanceServiceImpl.UNKNOWN_USER,
                byUser(service.getBalances("youssef", "g1")).get("ahmed").fullName());
    }

    @Test
    void theResponseNeverExposesEmailAddresses() {
        for (var component : MemberBalanceResponse.class.getRecordComponents()) {
            assertFalse(component.getName().toLowerCase().contains("email"), component.getName());
        }
    }

    @Test
    void aSingleBalance_isReturned_andAnUnknownMemberIsNotFound() {
        cahierExpenses();

        assertEquals(-6667L, service.getBalance("youssef", "g1", "ahmed").netMinor());
        assertEquals(ErrorCode.NOT_FOUND, assertThrows(ApiException.class,
                () -> service.getBalance("youssef", "g1", "nobody")).getCode());
    }

    @Test
    void aNonMember_isRejectedByTheGuard_andNothingIsRead() {
        when(guard.forRead("g1", "stranger")).thenThrow(new ApiException(ErrorCode.NOT_FOUND, "Group not found"));

        assertThrows(ApiException.class, () -> service.getBalances("stranger", "g1"));
        assertThrows(ApiException.class, () -> service.getBalance("stranger", "g1", "ahmed"));
        verifyNoInteractions(expenses, users);
    }

    @Test
    void corruptStoredData_isNotHidden() {
        // shares add up to 999, not 1000: this can only be corruption, so the request must fail loudly
        when(expenses.findByGroupIdAndStatus("g1", ExpenseStatus.ACTIVE)).thenReturn(List.of(
                expense("youssef", 1000, share("youssef", 500), share("ahmed", 499))));

        assertThrows(LedgerInvariantViolation.class, () -> service.getBalances("youssef", "g1"));
    }
}
