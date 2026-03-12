package com.daniel.messenger.messaging.dto

data class TypingEvent(
    val chatId: Long,
    val username: String,
    val isTyping: Boolean,
)
