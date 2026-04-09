package com.daniel.messenger.messaging.dto.event

import com.fasterxml.jackson.annotation.JsonInclude
import java.time.Instant

@JsonInclude(JsonInclude.Include.NON_NULL)
data class ChatUpdateEvent(
    val chatId: Long,
    val type: ChatUpdateType,
    val chatAvatarUrl: String? = null,
    val lastMessageContent: String? = null,
    val lastMessageSender: String? = null,
    val lastMessageCreatedAt: Instant? = null,
    val unreadCount: Long? = null,
    val lastMessageId: Long? = null,
    val peerLastReadMessageId: Long? = null,
)

enum class ChatUpdateType {
    CONTENT,
    READ_ACK,
    DELETED,
}
