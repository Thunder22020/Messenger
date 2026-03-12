package com.daniel.messenger.messaging.dto

data class PagedMessageResponse(
    val messages: List<MessageResponse>,
    val hasMore: Boolean,
)
