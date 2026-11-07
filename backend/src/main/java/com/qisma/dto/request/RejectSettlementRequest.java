package com.qisma.dto.request;

import jakarta.validation.constraints.Size;

public record RejectSettlementRequest(@Size(max = 200) String reason) {
}
