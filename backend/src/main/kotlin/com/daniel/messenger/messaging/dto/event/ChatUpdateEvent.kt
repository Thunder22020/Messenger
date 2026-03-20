package com.daniel.messenger.messaging.dto.event

import java.time.Instant

data class ChatUpdateEvent(
    val chatId: Long,
    val type: ChatUpdateType,
    val lastMessageContent: String? = null,
    val lastMessageSender: String? = null,
    val lastMessageCreatedAt: Instant? = null,
    val unreadCount: Long,
)

enum class ChatUpdateType {
    CONTENT,
    READ_ACK,
}
