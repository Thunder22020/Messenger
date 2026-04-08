package com.daniel.messenger.messaging.dto.response

data class WsReactionDto(
    val emoji: String,
    val count: Int,
    val reactorUsernames: List<String>,
)
