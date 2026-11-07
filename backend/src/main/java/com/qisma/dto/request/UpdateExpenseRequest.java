package com.qisma.dto.request;

import com.qisma.enums.ExpenseCategory;
import com.qisma.enums.SplitMethod;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

/**
 * Replaces the whole expense (not a patch). {@code version} is the version the client last saw: if someone
 * changed the expense since, the update is refused with 409 instead of silently overwriting their change.
 */
public record UpdateExpenseRequest(

        @NotNull @PositiveOrZero Long version,

        @NotBlank @Size(max = 120) String title,

        @Size(max = 1000) String description,

        @NotNull @Positive @Max(1_000_000_000_000L) Long amountMinor,

        @Pattern(regexp = "^[A-Za-z]{3}$", message = "must be a 3-letter ISO 4217 currency code") String currency,

        @NotBlank String paidBy,

        @NotNull LocalDate expenseDate,

        @NotNull ExpenseCategory category,

        @NotNull SplitMethod splitMethod,

        @NotEmpty @Size(max = 50) List<@Valid ParticipantInput> participants
) {

    public CreateExpenseRequest toCreateRequest() {
        return new CreateExpenseRequest(title, description, amountMinor, currency, paidBy,
                expenseDate, category, splitMethod, participants);
    }
}
