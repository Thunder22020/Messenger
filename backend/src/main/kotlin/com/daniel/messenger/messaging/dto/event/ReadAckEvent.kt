package com.daniel.messenger.messaging.dto.event

data class ReadAckEvent(
    val chatId: Long,
    val readerUsername: String,
    val lastReadMessageId: Long,
)
