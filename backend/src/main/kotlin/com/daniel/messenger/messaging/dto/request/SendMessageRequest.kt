package com.daniel.messenger.messaging.dto.request

data class SendMessageRequest(
    val chatId: Long,
    val content: String = "",
    val replyToMessageId: Long? = null,
    val attachmentIds: List<Long> = emptyList(),
)
