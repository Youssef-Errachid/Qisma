package com.qisma.dto.response;

import java.util.List;

/** A hint, not a commitment: nothing is stored, and creating a settlement re-checks the real balances. */
public record SuggestionsResponse(String currency, List<TransferSuggestionResponse> transfers) {
}
