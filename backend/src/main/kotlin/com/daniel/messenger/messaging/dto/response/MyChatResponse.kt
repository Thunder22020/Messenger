package com.daniel.messenger.messaging.dto.response

import com.daniel.messenger.messaging.enum.ChatType
import java.time.Instant

data class MyChatResponse(
    val chatId: Long,
    val type: ChatType,
    val displayName: String,
    val partnerUsername: String? = null,
    val chatAvatarUrl: String? = null,
    val lastMessageContent: String?,
    val lastMessageSender: String?,
    val lastMessageCreatedAt: Instant?,
    val unreadCount: Long,
    val lastReadMessageId: Long?,
    val lastMessageId: Long?,
    val peerLastReadMessageId: Long?,
    val pinnedAt: Instant?,
)
