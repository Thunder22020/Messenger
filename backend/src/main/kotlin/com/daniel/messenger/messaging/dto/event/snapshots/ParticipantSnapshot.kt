package com.daniel.messenger.messaging.dto.event.snapshots

data class ParticipantSnapshot(
    val username: String,
    val unreadCount: Long,
)
