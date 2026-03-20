package com.daniel.messenger.messaging.dto

import com.daniel.messenger.messaging.enum.ChatType
import java.time.Instant

data class ChatDTO(
    val id: Long,
    val type: ChatType,
    val title: String,
    val lastMessageId: Long,
    val lastMessageContent: String,
    val lastMessageSender: String?,
    val lastMessageCreatedAt: Instant,
    val createdAt: Instant,
)
