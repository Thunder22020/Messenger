package com.daniel.messenger.messaging.dto

data class ReadAckEvent(
    val chatId: Long,
    val readerUsername: String,
    val lastReadMessageId: Long,
)
