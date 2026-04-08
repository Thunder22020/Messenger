package com.daniel.messenger.messaging.dto.event

import com.daniel.messenger.messaging.dto.response.WsReactionDto

data class ReactionUpdatedEvent(
    val chatId: Long,
    val messageId: Long,
    val reactions: List<WsReactionDto>,
)
