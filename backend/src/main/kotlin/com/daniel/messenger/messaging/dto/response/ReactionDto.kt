package com.daniel.messenger.messaging.dto.response

data class ReactionDto(
    val emoji: String,
    val count: Int,
    val reactedByMe: Boolean,
)
