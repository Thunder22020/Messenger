package com.daniel.messenger.user.dto

import jakarta.validation.constraints.Size

data class UpdateDisplayNameRequest(
    @field:Size(max = 26)
    val displayName: String?
)
