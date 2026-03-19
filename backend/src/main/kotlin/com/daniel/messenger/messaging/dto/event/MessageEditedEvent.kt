package com.daniel.messenger.messaging.dto.event

import com.daniel.messenger.messaging.dto.ChatDTO
import com.daniel.messenger.messaging.dto.event.snapshots.ParticipantSnapshot
import com.daniel.messenger.messaging.dto.response.MessageResponse


data class MessageEditedEvent(
    val chat: ChatDTO,
    val participants: List<ParticipantSnapshot>,
    val response: MessageResponse,
)
