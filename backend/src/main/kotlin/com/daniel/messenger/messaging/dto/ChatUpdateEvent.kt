package com.daniel.messenger.messaging.dto

import java.time.Instant

data class ChatUpdateEvent(
    val chatId: Long,
    val lastMessageContent: String,
    val lastMessageCreatedAt: Instant,
    val unreadCount: Long
)
