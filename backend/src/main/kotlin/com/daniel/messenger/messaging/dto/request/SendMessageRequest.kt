package com.daniel.messenger.messaging.dto.request

import jakarta.validation.constraints.Size

data class SendMessageRequest(
    val chatId: Long,
    @field:Size(max = 5000)
    val content: String = "",
    val replyToMessageId: Long? = null,
    val attachmentIds: List<Long> = emptyList(),
)
