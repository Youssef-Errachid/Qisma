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
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

public record CreateExpenseRequest(

        @NotBlank @Size(max = 120) String title,

        @Size(max = 1000) String description,

        /** Whole minor units: 30000 means 300.00 MAD. */
        @NotNull @Positive @Max(1_000_000_000_000L) Long amountMinor,

        /** Optional. When present it must equal the group currency. */
        @Pattern(regexp = "^[A-Za-z]{3}$", message = "must be a 3-letter ISO 4217 currency code") String currency,

        @NotBlank String paidBy,

        @NotNull LocalDate expenseDate,

        @NotNull ExpenseCategory category,

        @NotNull SplitMethod splitMethod,

        @NotEmpty @Size(max = 50) List<@Valid ParticipantInput> participants
) {
}
