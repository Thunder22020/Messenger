package com.daniel.messenger.messaging.dto.request

import jakarta.validation.constraints.Size

data class EditMessageRequest(
    @field:Size(max = 5000)
    val content: String,
)
