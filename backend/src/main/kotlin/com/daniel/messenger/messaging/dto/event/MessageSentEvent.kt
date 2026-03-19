package com.daniel.messenger.messaging.dto.event

import com.daniel.messenger.messaging.dto.response.MessageResponse

data class ParticipantSnapshot(
    val username: String,
    val unreadCount: Long,
)

data class MessageSentEvent(
    val chatId: Long,
    val response: MessageResponse,
    val participants: List<ParticipantSnapshot>,
)
