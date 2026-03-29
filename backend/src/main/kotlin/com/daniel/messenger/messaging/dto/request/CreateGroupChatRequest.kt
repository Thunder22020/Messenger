package com.daniel.messenger.messaging.dto.request

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

data class CreateGroupChatRequest(
    @field:NotBlank(message = "Group name must not be blank")
    @field:Size(min = 1, max = 50, message = "Group name must be between 1 and 50 characters")
    val title: String,
    val participantIds: List<Long>
)
