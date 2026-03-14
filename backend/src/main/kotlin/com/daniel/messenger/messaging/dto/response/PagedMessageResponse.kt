package com.daniel.messenger.messaging.dto.response

data class PagedMessageResponse(
    val messages: List<MessageResponse>,
    val hasMoreOlder: Boolean,
    val hasMoreNewer: Boolean,
)
